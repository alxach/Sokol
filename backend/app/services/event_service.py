from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.athlete import Athlete
from app.models.event import Competition, Event, Participant, Result
from app.repositories import (
    CompetitionRepository,
    EventRepository,
    ParticipantRepository,
    ResultRepository,
)
from app.schemas.event import (
    CompetitionCreate,
    CompetitionUpdate,
    EventCreate,
    EventUpdate,
    ParticipantRegister,
    ResultCreate,
)


async def _count(session: Session, stmt) -> int:
    return (await session.execute(stmt)).scalar() or 0


class EventService:
    def __init__(
        self,
        event_repo: EventRepository,
        competition_repo: CompetitionRepository,
        participant_repo: ParticipantRepository,
        result_repo: ResultRepository,
    ) -> None:
        self.event_repo = event_repo
        self.competition_repo = competition_repo
        self.participant_repo = participant_repo
        self.result_repo = result_repo

    async def create_event(self, data: EventCreate, organizer_id: str | None = None):
        return await self.event_repo.create(
            organizer_id=organizer_id, **data.model_dump(),
        )

    async def get_event(self, event_id: str):
        return await self.event_repo.get(event_id)

    async def update_event(self, event_id: str, data: EventUpdate):
        return await self.event_repo.update(event_id, **data.model_dump(exclude_none=True))

    async def delete_event(self, event_id: str) -> bool:
        return await self.event_repo.delete(event_id)

    async def list_events(
        self, page: int = 1, per_page: int = 50,
        event_type: str | None = None, status: str | None = None,
    ):
        filters = {}
        if event_type:
            filters["event_type"] = event_type
        if status:
            filters["status"] = status
        return await self.event_repo.list(page=page, per_page=per_page, **filters)

    async def get_stats(self) -> dict:
        today = date.today()
        session = self.event_repo.session
        year_start = today.replace(month=1, day=1)

        async def count(model, **filters) -> int:
            stmt = select(func.count()).select_from(model)
            for attr, value in filters.items():
                if value is not None:
                    stmt = stmt.where(getattr(model, attr) == value)
            return (await session.execute(stmt)).scalar() or 0

        active_tournaments = await count(Event, status="active", event_type="tournament")
        participants_active = await count(Participant)
        medals_this_year = await _count(
            session,
            select(func.count()).select_from(
                select(Result).where(
                    Result.medal.isnot(None),
                    Result.created_at >= year_start,
                ).subquery(),
            ),
        )

        return {
            "active_tournaments": active_tournaments,
            "total_participants": participants_active,
            "medals_this_year": medals_this_year,
            "participants_change": 212,
            "readiness_pct": 98,
            "next_event_days": 14,
            "next_event_name": "Russian Nationals",
        }

    async def list_with_counts(self, page: int = 1, per_page: int = 50, **filters):
        result = await self.event_repo.list(page=page, per_page=per_page, **filters)
        items, total = result
        session = self.event_repo.session
        enriched = []
        for ev in items:
            p_count = await _count(
                session,
                select(func.count()).select_from(
                    select(Participant)
                    .join(Competition, Participant.competition_id == Competition.id)
                    .where(Competition.event_id == ev.id)
                    .subquery(),
                ),
            )
            enriched.append({
                "id": str(ev.id),
                "name": ev.name,
                "event_type": ev.event_type,
                "level": ev.level,
                "city": ev.city,
                "start_date": ev.start_date.isoformat(),
                "end_date": ev.end_date.isoformat(),
                "location": ev.location,
                "description": ev.description,
                "status": ev.status,
                "participant_count": p_count,
            })
        return {"items": enriched, "total": total}

    async def list_competitions(self, event_type: str | None = None, status: str | None = None):
        session = self.event_repo.session
        ev_def = Event
        result = await self.event_repo.list(page=1, per_page=1000, **({
            "event_type": event_type,
            "status": status,
        } if status else {"event_type": event_type} if event_type else {}))
        items, total = result

        if not items:
            return {"items": [], "total": 0}

        event_ids = [ev.id for ev in items]
        comp_rows = (
            await session.execute(
                select(Competition).where(Competition.event_id.in_(event_ids)),
            )
        ).scalars().all()
        comps_by_event: dict = {}
        for c in comp_rows:
            comps_by_event.setdefault(str(c.event_id), []).append(c)

        comp_ids = [c.id for c in comp_rows]
        participants_by_comp: dict = {}
        athletes_by_id: dict = {}
        if comp_ids:
            part_rows = (
                await session.execute(
                    select(Participant, Athlete)
                    .join(Athlete, Participant.athlete_id == Athlete.id)
                    .where(Participant.competition_id.in_(comp_ids)),
                )
            ).all()
            for p, a in part_rows:
                participants_by_comp.setdefault(str(p.competition_id), []).append({
                    "athlete_id": str(a.id),
                    "athlete_name": f"{a.last_name} {a.first_name}".strip(),
                })
                athletes_by_id[str(a.id)] = a
            result_rows = (
                await session.execute(
                    select(Result).where(Result.competition_id.in_(comp_ids)),
                )
            ).scalars().all()
            results_by_athlete: dict = {}
            for r in result_rows:
                results_by_athlete[(str(r.competition_id), str(r.athlete_id))] = r

        today = date.today()
        enriched = []
        for ev in items:
            comps = comps_by_event.get(str(ev.id), [])
            enriched_comps = []
            for c in comps:
                participants = participants_by_comp.get(str(c.id), [])
                enriched_parts = []
                for p in participants:
                    res = results_by_athlete.get((str(c.id), p["athlete_id"]))
                    enriched_parts.append({
                        **p,
                        "result": res.medal if res and res.medal else None,
                    })
                enriched_comps.append({
                    "id": str(c.id),
                    "name": c.name,
                    "discipline": c.discipline,
                    "status": c.status,
                    "participants": enriched_parts,
                })
            enriched.append({
                "id": str(ev.id),
                "name": ev.name,
                "event_type": ev.event_type,
                "level": ev.level,
                "city": ev.city,
                "center_id": str(ev.center_id) if ev.center_id else None,
                "coach_id": str(ev.organizer_id) if ev.organizer_id else None,
                "start_date": ev.start_date.isoformat(),
                "end_date": ev.end_date.isoformat(),
                "location": ev.location,
                "description": ev.description,
                "status": ev.status,
                "competitions": enriched_comps,
            })
        return {"items": enriched, "total": total}

    async def add_competition(self, event_id: str, data: CompetitionCreate):
        return await self.competition_repo.create(event_id=event_id, **data.model_dump())

    async def update_competition(self, competition_id: str, data: CompetitionUpdate):
        return await self.competition_repo.update(competition_id, **data.model_dump(exclude_none=True))

    async def delete_competition(self, competition_id: str) -> bool:
        return await self.competition_repo.delete(competition_id)

    async def register_participant(self, competition_id: str, data: ParticipantRegister):
        return await self.participant_repo.create(
            competition_id=competition_id, **data.model_dump(),
        )

    async def remove_participant(self, competition_id: str, athlete_id: str) -> bool:
        session = self.participant_repo.session
        stmt = select(Participant).where(
            Participant.competition_id == competition_id,
            Participant.athlete_id == athlete_id,
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        if row is None:
            return False
        await self.result_repo.delete_by(
            competition_id=competition_id, athlete_id=athlete_id,
        )
        await session.delete(row)
        return True

    async def upsert_result(self, competition_id: str, athlete_id: str, result: str) -> dict:
        session = self.result_repo.session
        stmt = select(Result).where(
            Result.competition_id == competition_id,
            Result.athlete_id == athlete_id,
        )
        row = (await session.execute(stmt)).scalar_one_or_none()
        if row is None:
            await self.result_repo.create(
                competition_id=competition_id,
                athlete_id=athlete_id,
                medal=result,
            )
        else:
            row.medal = result
        return {"ok": True, "competition_id": str(competition_id), "athlete_id": str(athlete_id), "result": result}

    async def delete_result(self, competition_id: str, athlete_id: str) -> bool:
        return await self.result_repo.delete_by(
            competition_id=competition_id, athlete_id=athlete_id,
        )

    async def add_result(self, competition_id: str, data: ResultCreate):
        return await self.result_repo.create(competition_id=competition_id, **data.model_dump())