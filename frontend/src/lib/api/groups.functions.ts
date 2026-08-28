import { apiFetch } from "@/lib/api/client";

export interface GroupDto {
  id: string;
  name: string;
  center_id: string | null;
  coach_id: string | null;
  sport_type: string;
  age_group: string | null;
  skill_level: string | null;
  max_capacity: number;
  schedule_note: string | null;
  is_active: boolean;
  created_at: string;
  coach_name: string | null;
  coach_user_id: string | null;
  center_name: string | null;
  center_city: string | null;
  athlete_ids: string[];
  athlete_count: number;
}

export interface GroupCreatePayload {
  name: string;
  sport_type: string;
  coach_id?: string;
  center_id?: string;
  age_group?: string;
  skill_level?: string;
  max_capacity?: number;
  schedule_note?: string;
}

export interface GroupUpdatePayload {
  name?: string;
  sport_type?: string;
  coach_id?: string;
  center_id?: string;
  age_group?: string;
  skill_level?: string;
  max_capacity?: number;
  schedule_note?: string;
  is_active?: boolean;
}

export interface GroupMemberAddPayload {
  athlete_id: string;
  join_date?: string;
}

export async function fetchGroups(params: {
  page?: number;
  perPage?: number;
  centerId?: string | null;
} = {}): Promise<{ items: GroupDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage ?? 1000));
  if (params.centerId) qs.set("center_id", params.centerId);
  const query = qs.size ? `?${qs.toString()}` : "";
  const [items, total] = await apiFetch<[GroupDto[], number]>(`/groups${query}`);
  return { items, total };
}

export async function fetchGroup(groupId: string): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/groups/${groupId}`);
}

export async function createGroup(payload: GroupCreatePayload): Promise<GroupDto> {
  return apiFetch<GroupDto>("/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateGroup(
  groupId: string,
  payload: GroupUpdatePayload,
): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiFetch(`/groups/${groupId}`, { method: "DELETE" });
}

export async function addGroupMember(
  groupId: string,
  payload: GroupMemberAddPayload,
): Promise<void> {
  await apiFetch(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeGroupMember(groupId: string, athleteId: string): Promise<void> {
  await apiFetch(`/groups/${groupId}/members/${athleteId}`, { method: "DELETE" });
}