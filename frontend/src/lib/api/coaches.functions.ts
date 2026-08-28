import { apiFetch } from "@/lib/api/client";

export interface CoachDto {
  id: string;
  user_id: string;
  center_id: string | null;
  specialization: string;
  qualification: string | null;
  biography: string | null;
  hire_date: string;
  is_active: boolean;
}

async function fetchCoachesList(params: {
  centerId?: string | null;
  perPage?: number;
} = {}): Promise<CoachDto[]> {
  const qs = new URLSearchParams();
  if (params.centerId) qs.set("center_id", params.centerId);
  qs.set("per_page", String(params.perPage ?? 1000));
  const [items] = await apiFetch<[CoachDto[], number]>(`/coaches?${qs.toString()}`);
  return items;
}

export async function fetchCoaches(): Promise<CoachDto[]> {
  return fetchCoachesList();
}

export async function findCoachByUserId(userId: string): Promise<CoachDto | null> {
  const coaches = await fetchCoachesList();
  return coaches.find((c) => c.user_id === userId) ?? null;
}