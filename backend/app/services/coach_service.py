from collections import defaultdict
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.models.athlete import Athlete
from app.models.audit import AuditLog
from app.models.coach import Coach, CoachSickLeave, CoachVacation
from app.models.group import Group
from app.models.organization import Center
from app.models.user import User
from app.repositories import CoachRepository
from app.schemas.coach import CoachCreate, CoachUpdate
from app.services.audit_service import AuditService


class CoachService:
    def __init__(self, coach_repo: CoachRepository) -> None:
        self.coach_repo = coach_repo

    @property
    def session(self):
        return self.coach_repo.session

    async def create(self, data: CoachCreate):
        dump = data.model_dump()
        vacations_data = dump.pop("vacations", [])
        sick_leaves_data = dump.pop("sick_leaves", [])
        coach = await self.coach_repo.create(**dump)
        for v in vacations_data:
            self.session.add(CoachVacation(coach_id=coach.id, **v))
        for s in sick_leaves_data:
            self.session.add(CoachSickLeave(coach_id=coach.id, **s))
        await self.coach_repo.session.flush()
        return (await self._enrich([coach]))[0]

    async def get(self, coach_id: str, user=None):
        coach = await self.coach_repo.get(coach_id)
        if not coach:
            return None
        if user is not None:
            await self._assert_center_access(coach, user)
        return (await self._enrich([coach]))[0]

    async def get_by_user_id(self, user_id: str):
        coach = await self.coach_repo.get_by_user_id(user_id)
        if not coach:
            return None
        return (await self._enrich([coach]))[0]

    async def get_by_user_id_with_relations(self, user_id: str):
        """Get coach by user_id with vacations and sick_leaves eagerly loaded."""
        stmt = (
            select(self.coach_repo.model)
            .where(self.coach_repo.model.user_id == UUID(user_id))
            .options(selectinload(self.coach_repo.model.vacations), selectinload(self.coach_repo.model.sick_leaves))
        )
        result = await self.coach_repo.session.execute(stmt)
        coach = result.scalar_one_or_none()
        if not coach:
            return None
        return (await self._enrich([coach]))[0]

    async def list(
        self, page: int = 1, per_page: int = 50, center_id: str | None = None, user=None,
    ):
        if user is not None and self._admin_scoped(user):
            user_row = await self._user_row(user.id)
            if not user_row or not user_row.center_id:
                return [], 0
            center_id = str(user_row.center_id)
        coaches, total = await self.coach_repo.list(
            page=page, per_page=per_page, center_id=center_id,
        )
        return await self._enrich(coaches), total

    @staticmethod
    def _admin_scoped(user) -> bool:
        return (
            "admin" in user.roles
            and "director" not in user.roles
            and "superadmin" not in user.roles
        )

    async def _user_row(self, user_id: str) -> User | None:
        return await self.session.get(User, UUID(user_id))

    async def _assert_center_access(self, coach, user) -> None:
        if not self._admin_scoped(user):
            return
        user_row = await self._user_row(user.id)
        if (
            not user_row
            or not user_row.center_id
            or str(coach.center_id) != str(user_row.center_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Coach belongs to another center"
            )

    async def update(self, coach_id: str, data: CoachUpdate, user=None):
        coach = await self.coach_repo.get(coach_id)
        if not coach:
            return None
        if user is not None:
            await self._assert_center_access(coach, user)
        dump = data.model_dump(exclude_none=True)
        vacations_data = dump.pop("vacations", None)
        sick_leaves_data = dump.pop("sick_leaves", None)
        if vacations_data is not None:
            await self.session.execute(
                delete(CoachVacation).where(CoachVacation.coach_id == coach.id),
            )
            await self.session.flush()
            for v in vacations_data:
                self.session.add(CoachVacation(coach_id=coach.id, **v))
        if sick_leaves_data is not None:
            await self.session.execute(
                delete(CoachSickLeave).where(CoachSickLeave.coach_id == coach.id),
            )
            await self.session.flush()
            for s in sick_leaves_data:
                self.session.add(CoachSickLeave(coach_id=coach.id, **s))
        await self.coach_repo.session.flush()
        clean = {k: v for k, v in dump.items() if v is not None}
        if clean:
            coach = await self.coach_repo.update(coach_id, **clean)
        if not coach:
            return None
        return (await self._enrich([coach]))[0]

    async def update_by_user_id(
        self,
        user_id: str,
        data: CoachUpdate,
        current_user_roles: list[str],
        current_user_id: str,
    ):
        """Update coach profile by user_id with role-based permissions and audit."""
        # Load coach with relations for audit
        coach = await self.coach_repo.get_by_user_id(user_id)
        if not coach:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

        # Load relations eagerly for audit
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Coach)
            .where(Coach.user_id == UUID(user_id))
            .options(selectinload(Coach.vacations), selectinload(Coach.sick_leaves))
        )
        result = await self.session.execute(stmt)
        coach_with_relations = result.scalar_one()

        # Check permissions
        is_coach = "coach" in current_user_roles
        is_director = "director" in current_user_roles
        is_admin = "admin" in current_user_roles or "superadmin" in current_user_roles

        if is_coach and not is_admin and not is_director:
            # Coach can only edit their own profile
            if str(coach_with_relations.user_id) != current_user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        elif is_director and not is_admin:
            # Director can only edit coaches in their center
            user = await self.session.get(User, UUID(current_user_id))
            if not user or not user.center_id or str(user.center_id) != str(coach_with_relations.center_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

        # Determine allowed fields based on role
        allowed_fields = {"vacations", "sick_leaves", "biography", "specialization"}
        if is_admin:
            allowed_fields.update({"qualification", "is_active", "center_id", "hire_date"})
        elif is_director:
            allowed_fields.update({"qualification", "is_active"})

        # Capture old values for audit (using eagerly loaded relations)
        old_vacations = [
            {"id": str(v.id), "start_date": v.start_date.isoformat(), "end_date": v.end_date.isoformat()}
            for v in coach_with_relations.vacations
        ]
        old_sick_leaves = [
            {"id": str(s.id), "start_date": s.start_date.isoformat(), "end_date": s.end_date.isoformat()}
            for s in coach_with_relations.sick_leaves
        ]

        dump = data.model_dump(exclude_none=True)

        # Filter to only allowed fields
        filtered_dump = {k: v for k, v in dump.items() if k in allowed_fields}
        vacations_data = filtered_dump.pop("vacations", None)
        sick_leaves_data = filtered_dump.pop("sick_leaves", None)

        # Validate overlaps with existing data
        # Get existing vacations and sick_leaves if not being replaced
        existing_vacations = coach_with_relations.vacations if vacations_data is None else []
        existing_sick_leaves = coach_with_relations.sick_leaves if sick_leaves_data is None else []

        # Convert to CoachVacationCreate/CoachSickLeaveCreate for validation
        from app.schemas.coach import CoachVacationCreate, CoachSickLeaveCreate

        if vacations_data is not None:
            new_vacations = [CoachVacationCreate(**v) for v in vacations_data]
            # Check overlap with existing sick_leaves
            if existing_sick_leaves:
                for v in new_vacations:
                    for s in existing_sick_leaves:
                        if v.start_date <= s.end_date and s.start_date <= v.end_date:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Пересечение отпуска ({v.start_date}–{v.end_date}) и больничного ({s.start_date}–{s.end_date})"
                            )
        if sick_leaves_data is not None:
            new_sick_leaves = [CoachSickLeaveCreate(**s) for s in sick_leaves_data]
            # Check overlap with existing vacations
            if existing_vacations:
                for s in new_sick_leaves:
                    for v in existing_vacations:
                        if v.start_date <= s.end_date and s.start_date <= v.end_date:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=f"Пересечение отпуска ({v.start_date}–{v.end_date}) и больничного ({s.start_date}–{s.end_date})"
                            )

        # Update vacations
        if vacations_data is not None:
            await self.session.execute(
                delete(CoachVacation).where(CoachVacation.coach_id == coach.id),
            )
            await self.session.flush()
            for v in vacations_data:
                self.session.add(CoachVacation(coach_id=coach.id, **v))

        # Update sick leaves
        if sick_leaves_data is not None:
            await self.session.execute(
                delete(CoachSickLeave).where(CoachSickLeave.coach_id == coach.id),
            )
            await self.session.flush()
            for s in sick_leaves_data:
                self.session.add(CoachSickLeave(coach_id=coach.id, **s))

        await self.coach_repo.session.flush()

        # Update other fields
        if filtered_dump:
            coach = await self.coach_repo.update(coach.id, **filtered_dump)

        if not coach:
            return None

        # Capture new values for audit
        new_vacations = [
            {"id": str(v.id), "start_date": v.start_date.isoformat(), "end_date": v.end_date.isoformat()}
            for v in coach.vacations
        ]
        new_sick_leaves = [
            {"id": str(s.id), "start_date": s.start_date.isoformat(), "end_date": s.end_date.isoformat()}
            for s in coach.sick_leaves
        ]

        # Audit logging
        audit = AuditService(self.session)
        if vacations_data is not None:
            await audit.log(
                user_id=current_user_id,
                action="coach_vacations_updated",
                resource="coach",
                resource_id=str(coach.id),
                old_value={"vacations": old_vacations},
                new_value={"vacations": new_vacations},
            )
        if sick_leaves_data is not None:
            await audit.log(
                user_id=current_user_id,
                action="coach_sick_leaves_updated",
                resource="coach",
                resource_id=str(coach.id),
                old_value={"sick_leaves": old_sick_leaves},
                new_value={"sick_leaves": new_sick_leaves},
            )
        if filtered_dump:
            await audit.log(
                user_id=current_user_id,
                action="coach_profile_updated",
                resource="coach",
                resource_id=str(coach.id),
                old_value={},
                new_value=filtered_dump,
            )

        return (await self._enrich([coach]))[0]

    async def _enrich(self, coaches: list[Coach]) -> list[dict]:
        if not coaches:
            return []
        coach_ids = [c.id for c in coaches]
        user_ids = [c.user_id for c in coaches]
        center_ids = {c.center_id for c in coaches if c.center_id}

        users: dict[str, tuple[str, str]] = {}
        if user_ids:
            rows = (
                await self.session.execute(
                    select(User.id, User.first_name, User.last_name).where(
                        User.id.in_(user_ids),
                    ),
                )
            ).all()
            users = {str(uid): (first, last) for uid, first, last in rows}

        centers: dict[str, tuple[str, str]] = {}
        if center_ids:
            rows = (
                await self.session.execute(
                    select(Center.id, Center.name, Center.city).where(
                        Center.id.in_(center_ids),
                    ),
                )
            ).all()
            centers = {str(cid): (name, city) for cid, name, city in rows}

        groups_counts = dict(
            (
                await self.session.execute(
                    select(Group.coach_id, func.count())
                    .where(Group.coach_id.in_(coach_ids))
                    .group_by(Group.coach_id),
                )
            ).all(),
        )
        athletes_counts = dict(
            (
                await self.session.execute(
                    select(Athlete.coach_id, func.count())
                    .where(Athlete.coach_id.in_(coach_ids))
                    .group_by(Athlete.coach_id),
                )
            ).all(),
        )

        vacations: dict[str, list[dict]] = defaultdict(list)
        if coach_ids:
            rows = (
                await self.session.execute(
                    select(
                        CoachVacation.coach_id,
                        CoachVacation.id,
                        CoachVacation.start_date,
                        CoachVacation.end_date,
                    ).where(CoachVacation.coach_id.in_(coach_ids)),
                )
            ).all()
            for cid, vid, start, end in rows:
                vacations[str(cid)].append({
                    "id": str(vid),
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                })

        sick_leaves: dict[str, list[dict]] = defaultdict(list)
        if coach_ids:
            rows = (
                await self.session.execute(
                    select(
                        CoachSickLeave.coach_id,
                        CoachSickLeave.id,
                        CoachSickLeave.start_date,
                        CoachSickLeave.end_date,
                    ).where(CoachSickLeave.coach_id.in_(coach_ids)),
                )
            ).all()
            for cid, sid, start, end in rows:
                sick_leaves[str(cid)].append({
                    "id": str(sid),
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                })

        result = []
        for coach in coaches:
            first, last = users.get(str(coach.user_id), ("", ""))
            center_name, center_city = centers.get(str(coach.center_id), (None, None))
            result.append({
                "id": str(coach.id),
                "user_id": str(coach.user_id),
                "center_id": str(coach.center_id) if coach.center_id else None,
                "specialization": coach.specialization,
                "qualification": coach.qualification,
                "biography": coach.biography,
                "hire_date": coach.hire_date.isoformat(),
                "is_active": coach.is_active,
                "name": " ".join(x for x in [last, first] if x).strip(),
                "center_name": center_name,
                "center_city": center_city,
                "groups_count": groups_counts.get(coach.id, 0),
                "athletes_count": athletes_counts.get(coach.id, 0),
                "vacations": vacations.get(str(coach.id), []),
                "sick_leaves": sick_leaves.get(str(coach.id), []),
            })
        return result
