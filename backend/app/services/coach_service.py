from collections import defaultdict

from sqlalchemy import delete, func, select

from app.models.athlete import Athlete
from app.models.coach import Coach, CoachSickLeave, CoachVacation
from app.models.group import Group
from app.models.organization import Center
from app.models.user import User
from app.repositories import CoachRepository
from app.schemas.coach import CoachCreate, CoachUpdate


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

    async def get(self, coach_id: str):
        coach = await self.coach_repo.get(coach_id)
        if not coach:
            return None
        return (await self._enrich([coach]))[0]

    async def list(self, page: int = 1, per_page: int = 50, center_id: str | None = None):
        coaches, total = await self.coach_repo.list(
            page=page, per_page=per_page, center_id=center_id,
        )
        return await self._enrich(coaches), total

    async def update(self, coach_id: str, data: CoachUpdate):
        dump = data.model_dump(exclude_none=True)
        vacations_data = dump.pop("vacations", None)
        sick_leaves_data = dump.pop("sick_leaves", None)
        coach = await self.coach_repo.get(coach_id)
        if not coach:
            return None
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
