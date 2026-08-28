from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, require_roles
from app.dependencies import get_organization_service
from app.schemas.organization import (
    CenterCreate,
    CenterUpdate,
    RegionCreate,
    RegionUpdate,
)
from app.services.organization_service import OrganizationService

router = APIRouter(
    prefix="/organizations",
    tags=["organizations"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/regions", dependencies=[Depends(require_roles("superadmin"))])
async def create_region(
    data: RegionCreate,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.create_region(data)


@router.get("/regions")
async def list_regions(
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.list_regions()


@router.get("/regions/{region_id}")
async def get_region(
    region_id: str,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.get_region(region_id)


@router.patch("/regions/{region_id}", dependencies=[Depends(require_roles("superadmin"))])
async def update_region(
    region_id: str,
    data: RegionUpdate,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.update_region(region_id, data)


@router.delete("/regions/{region_id}", dependencies=[Depends(require_roles("superadmin"))])
async def delete_region(
    region_id: str,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.delete_region(region_id)


@router.post("/centers", dependencies=[Depends(require_roles("director"))])
async def create_center(
    data: CenterCreate,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.create_center(data)


@router.get("/centers", dependencies=[Depends(require_roles("admin", "director"))])
async def list_centers(
    region_id: str | None = None,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.list_centers(region_id)


@router.get("/centers/{center_id}", dependencies=[Depends(require_roles("admin", "director"))])
async def get_center(
    center_id: str,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.get_center(center_id)


@router.put("/centers/{center_id}", dependencies=[Depends(require_roles("superadmin"))])
async def update_center(
    center_id: str,
    data: CenterUpdate,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.update_center(center_id, data)


@router.delete("/centers/{center_id}", dependencies=[Depends(require_roles("superadmin"))])
async def delete_center(
    center_id: str,
    service: OrganizationService = Depends(get_organization_service),
):
    return await service.delete_center(center_id)
