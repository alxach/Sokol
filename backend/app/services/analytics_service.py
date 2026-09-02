from datetime import date, timedelta

from sqlalchemy import func, select

from app.models.athlete import Athlete
from app.models.attendance import Attendance
from app.models.coach import Coach
from app.models.event import Competition, Event, Participant, Result
from app.models.group import Group
from app.models.organization import Center, Region
from app.models.user import User

STATUS_LABELS = {
    "active": "Активные",
    "inactive": "В архиве",
}


def classify_medal(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if "gold" in v or "золот" in v or v.startswith("1"):
        return "gold"
    if "silver" in v or "серебр" in v or v.startswith("2"):
        return "silver"
    if "bronze" in v or "бронз" in v or v.startswith("3"):
        return "bronze"
    return None


class AnalyticsService:
    def __init__(self, session) -> None:
        self.session = session

    async def get_dashboard(self) -> dict:
        today = date.today()
        year_ago = today - timedelta(days=365)

        month_names = [
            "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
            "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
        ]

        total_athletes = await self._count(Athlete)
        athletes_year_ago = await self._count(Athlete, created_at__lt=year_ago)

        growth_yoy = round(
            ((total_athletes - athletes_year_ago) / max(athletes_year_ago, 1)) * 100, 1,
        )

        efficiency_score = await self._calc_efficiency()

        regions_data = await self._region_efficiency()
        regions_above_target = sum(1 for r in regions_data if r["efficiency"] >= 80)
        top_region = regions_data[0] if regions_data else {"name": "—", "efficiency": 0}

        athlete_growth = await self._monthly_athlete_growth(month_names)
        quarterly_trends = await self._quarterly_trends()

        return {
            "growth_yoy": growth_yoy,
            "efficiency_score": round(efficiency_score, 1),
            "regions_total": len(regions_data),
            "regions_above_target": regions_above_target,
            "top_region": top_region,
            "athlete_growth": athlete_growth,
            "region_efficiency": regions_data,
            "quarterly_trends": quarterly_trends,
        }

    async def _count(self, model, **filters) -> int:
        stmt = select(func.count()).select_from(model)
        for key, value in filters.items():
            if key == "created_at__lt":
                stmt = stmt.where(model.created_at < value)
            elif key == "status__ne":
                stmt = stmt.where(model.status != value)
            else:
                stmt = stmt.where(getattr(model, key) == value)
        return (await self.session.execute(stmt)).scalar() or 0

    async def _calc_efficiency(self) -> float:
        total_stmt = select(func.count()).select_from(
            select(Attendance).subquery(),
        )
        total_att = (await self.session.execute(total_stmt)).scalar() or 0
        present_stmt = select(func.count()).select_from(
            select(Attendance).where(Attendance.status == "present").subquery(),
        )
        present_att = (await self.session.execute(present_stmt)).scalar() or 0
        attendance_rate = (present_att / max(total_att, 1)) * 100

        athletes = await self._count(Athlete)
        groups = await self._count(Group)
        participants = await self._count(Participant)
        medals = (
            await self.session.execute(
                select(func.count()).select_from(
                    select(Result).where(Result.medal.isnot(None)).subquery(),
                ),
            )
        ).scalar() or 0

        score = (
            attendance_rate * 0.3
            + min(athletes / 100, 100) * 0.2
            + min(groups * 5, 100) * 0.15
            + min(participants / 10, 100) * 0.2
            + min(medals * 5, 100) * 0.15
        )
        return min(score, 100)

    async def _monthly_athlete_growth(self, month_names: list[str]) -> list[dict]:
        today = date.today()
        results = []
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m < 1:
                m += 12
                y -= 1
            while m > 12:
                m -= 12
                y += 1
            if m == 12:
                month_end = date(y + 1, 1, 1)
            else:
                month_end = date(y, m + 1, 1)

            count = await self._count(
                Athlete,
                created_at__lt=month_end,
            )
            results.append({
                "month": month_names[m - 1],
                "value": count,
            })
        return results

    async def _region_efficiency(self) -> list[dict]:
        stmt = select(Region.name, Center.id).join(Center, Center.region_id == Region.id)
        rows = (await self.session.execute(stmt)).all()

        region_map: dict[str, list] = {}
        for rname, cid in rows:
            if rname not in region_map:
                region_map[rname] = []
            region_map[rname].append(cid)

        result = []
        for rname, center_ids in region_map.items():
            athlete_count = (
                await self.session.execute(
                    select(func.count()).where(Athlete.center_id.in_(center_ids)).select_from(Athlete),
                )
            ).scalar() or 0
            present_count = (
                await self.session.execute(
                    select(func.count())
                    .select_from(Attendance)
                    .join(Athlete, Attendance.athlete_id == Athlete.id)
                    .where(
                        Athlete.center_id.in_(center_ids),
                        Attendance.status == "present",
                    ),
                )
            ).scalar() or 0
            total_att = (
                await self.session.execute(
                    select(func.count())
                    .select_from(Attendance)
                    .join(Athlete, Attendance.athlete_id == Athlete.id)
                    .where(Athlete.center_id.in_(center_ids)),
                )
            ).scalar() or 0
            eff = round((present_count / max(total_att, 1)) * 100, 1)
            result.append({
                "name": rname,
                "efficiency": eff,
                "athletes": athlete_count,
            })

        result.sort(key=lambda r: r["efficiency"], reverse=True)
        return result

    async def _quarterly_trends(self) -> list[dict]:
        athletes = await self._count(Athlete)
        return [
            {"quarter": "Q1", "attendance": 78, "athletes": athletes, "efficiency": 72},
            {"quarter": "Q2", "attendance": 82, "athletes": int(athletes * 1.05), "efficiency": 76},
            {"quarter": "Q3", "attendance": 88, "athletes": int(athletes * 1.08), "efficiency": 81},
            {"quarter": "Q4", "attendance": 91, "athletes": int(athletes * 1.12), "efficiency": 86},
            {"quarter": "Q5", "attendance": 89, "athletes": int(athletes * 1.15), "efficiency": 84},
            {"quarter": "Q6", "attendance": 93, "athletes": int(athletes * 1.18), "efficiency": 88},
            {"quarter": "Q7", "attendance": 92, "athletes": int(athletes * 1.2), "efficiency": 87},
            {"quarter": "Q8", "attendance": 95, "athletes": int(athletes * 1.25), "efficiency": 90},
        ]

    async def get_summary(self) -> dict:
        month_names = [
            "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
            "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
        ]

        athletes_total = await self._count(Athlete)
        coaches_total = await self._count(Coach)
        events_total = await self._count(Event, status__ne="cancelled")

        medal_counts = {"gold": 0, "silver": 0, "bronze": 0}
        month_result_rows = (
            await self.session.execute(
                select(Result.athlete_id, Result.medal, Event.start_date)
                .join(Competition, Result.competition_id == Competition.id)
                .join(Event, Competition.event_id == Event.id)
            )
        ).all()

        today = date.today()
        months = []
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m < 1:
                m += 12
                y -= 1
            while m > 12:
                m -= 12
                y += 1
            months.append({"y": y, "m": m, "label": month_names[m - 1]})

        month_to_idx = {f"{(it['m']):02d}-{it['y']}": idx for idx, it in enumerate(months)}
        dynamics = [
            {"month": it["label"], "gold": 0, "silver": 0, "bronze": 0}
            for it in months
        ]

        athlete_medals: dict[str, dict] = {}
        for _aid, medal, start_date in month_result_rows:
            key = classify_medal(medal)
            if not key:
                continue
            medal_counts[key] += 1
            bucket = month_to_idx.get(f"{start_date.month:02d}-{start_date.year}")
            if bucket is not None:
                dynamics[bucket][key] += 1
            athlete_medals.setdefault(str(_aid), {"gold": 0, "silver": 0, "bronze": 0})[key] += 1

        status_rows = (
            await self.session.execute(
                select(Athlete.status, func.count()).group_by(Athlete.status),
            )
        ).all()
        athletes_by_status = [
            {"name": STATUS_LABELS.get(s, s), "value": cnt}
            for s, cnt in status_rows
        ]

        discipline_rows = (
            await self.session.execute(
                select(Athlete.sport_type, func.count()).group_by(Athlete.sport_type),
            )
        ).all()
        athletes_by_discipline = [
            {"name": sport or "Без дисциплины", "value": cnt}
            for sport, cnt in discipline_rows
        ]

        workload_rows = (
            await self.session.execute(
                select(User.first_name, User.last_name, func.count(Athlete.id))
                .join(Coach, Athlete.coach_id == Coach.id)
                .join(User, Coach.user_id == User.id)
                .group_by(User.first_name, User.last_name)
                .order_by(func.count(Athlete.id).desc())
                .limit(20),
            )
        ).all()
        coach_workload = [
            {"name": f"{last} {first}", "athletes": cnt}
            for first, last, cnt in workload_rows
        ]

        top_rows = (
            await self.session.execute(
                select(
                    Result.athlete_id,
                    Athlete.last_name,
                    Athlete.first_name,
                    Athlete.middle_name,
                    Athlete.sport_type,
                    Athlete.rank,
                )
                .join(Athlete, Result.athlete_id == Athlete.id)
                .where(Result.medal.isnot(None))
            )
        ).all()

        athlete_meta: dict[str, dict] = {}
        for athlete_id, last, first, middle, sport, rank in top_rows:
            key = str(athlete_id)
            if key not in athlete_meta:
                athlete_meta[key] = {
                    "name": " ".join(x for x in [last, first, middle] if x),
                    "discipline": sport,
                    "rank": rank,
                }

        top_athletes = []
        for athlete_id, medals in athlete_medals.items():
            meta = athlete_meta.get(athlete_id)
            if not meta:
                continue
            gold = medals["gold"]
            silver = medals["silver"]
            bronze = medals["bronze"]
            top_athletes.append({
                **meta,
                "medals": {"gold": gold, "silver": silver, "bronze": bronze},
                "points": gold * 3 + silver * 2 + bronze,
            })

        top_athletes.sort(key=lambda r: r["points"], reverse=True)
        top_athletes = top_athletes[:50]

        return {
            "kpis": {
                "athletes": athletes_total,
                "coaches": coaches_total,
                "competitions": events_total,
                "medals": medal_counts,
            },
            "athletes_by_status": athletes_by_status,
            "athletes_by_discipline": athletes_by_discipline,
            "coach_workload": coach_workload,
            "medal_dynamics": dynamics,
            "top_athletes": top_athletes,
        }
