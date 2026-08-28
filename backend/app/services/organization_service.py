from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.repositories import CenterRepository, RegionRepository
from app.schemas.organization import CenterCreate, CenterUpdate, RegionCreate, RegionUpdate


class OrganizationService:
    def __init__(self, region_repo: RegionRepository, center_repo: CenterRepository) -> None:
        self.region_repo = region_repo
        self.center_repo = center_repo

    async def create_region(self, data: RegionCreate):
        return await self.region_repo.create(**data.model_dump())

    async def list_regions(self):
        regions, _ = await self.region_repo.list()
        return regions

    async def get_region(self, region_id: str):
        region = await self.region_repo.get(region_id)
        if not region:
            raise HTTPException(status_code=404, detail="Region not found")
        return region

    async def update_region(self, region_id: str, data: RegionUpdate):
        region = await self.region_repo.update(
            region_id, **data.model_dump(exclude_unset=True),
        )
        if not region:
            raise HTTPException(status_code=404, detail="Region not found")
        return region

    async def delete_region(self, region_id: str):
        region = await self.region_repo.get(region_id)
        if not region:
            raise HTTPException(status_code=404, detail="Region not found")
        centers, _ = await self.center_repo.list(region_id=region_id)
        if centers:
            raise HTTPException(status_code=409, detail="Region has centers")
        await self.region_repo.delete(region_id)
        return {"detail": "Region deleted"}

    async def create_center(self, data: CenterCreate):
        return await self.center_repo.create(**data.model_dump())

    async def list_centers(self, region_id: str | None = None):
        centers, _ = await self.center_repo.list(region_id=region_id)
        return centers

    async def get_center(self, center_id: str):
        center = await self.center_repo.get(center_id)
        if not center:
            raise HTTPException(status_code=404, detail="Center not found")
        return center

    async def update_center(self, center_id: str, data: CenterUpdate):
        center = await self.center_repo.update(
            center_id, **data.model_dump(exclude_unset=True),
        )
        if not center:
            raise HTTPException(status_code=404, detail="Center not found")
        return center

    async def delete_center(self, center_id: str):
        center = await self.center_repo.get(center_id)
        if not center:
            raise HTTPException(status_code=404, detail="Center not found")
        try:
            await self.center_repo.delete(center_id)
        except IntegrityError:
            await self.center_repo.session.rollback()
            raise HTTPException(status_code=409, detail="Center has related data")
        return {"detail": "Center deleted"}
