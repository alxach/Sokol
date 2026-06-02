from app.repositories import CenterRepository, RegionRepository
from app.schemas.organization import CenterCreate, RegionCreate


class OrganizationService:
    def __init__(self, region_repo: RegionRepository, center_repo: CenterRepository) -> None:
        self.region_repo = region_repo
        self.center_repo = center_repo

    async def create_region(self, data: RegionCreate):
        return await self.region_repo.create(**data.model_dump())

    async def list_regions(self):
        regions, _ = await self.region_repo.list()
        return regions

    async def create_center(self, data: CenterCreate):
        return await self.center_repo.create(**data.model_dump())

    async def list_centers(self, region_id: str | None = None):
        centers, _ = await self.center_repo.list(region_id=region_id)
        return centers

    async def get_center(self, center_id: str):
        return await self.center_repo.get(center_id)
