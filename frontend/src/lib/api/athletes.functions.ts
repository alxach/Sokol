import { apiFetch } from "@/lib/api/client";

export type AthleteStatusKey =
  | "active"
  | "inactive"
  | "graduated"
  | "transferred"
  | "expelled";

export interface AthleteDto {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  birth_date: string;
  gender: string;
  center_id: string | null;
  coach_id: string | null;
  sport_type: string;
  rank: string | null;
  status: string;
  enrollment_type: string;
  notes: string | null;
  created_at: string;
  coach_name: string | null;
  coach_user_id: string | null;
  center_name: string | null;
  center_city: string | null;
}

export interface AthleteCreatePayload {
  first_name: string;
  last_name: string;
  middle_name?: string;
  birth_date: string;
  gender: string;
  center_id?: string;
  coach_id?: string;
  sport_type: string;
  notes?: string;
}

export interface AthleteUpdatePayload {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  birth_date?: string;
  gender?: string;
  sport_type?: string;
  rank?: string;
  status?: AthleteStatusKey;
  notes?: string;
}

export function calcAge(birthDate: string): number {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function athleteFullName(a: Pick<AthleteDto, "last_name" | "first_name" | "middle_name">): string {
  return [a.last_name, a.first_name, a.middle_name ?? ""].filter(Boolean).join(" ");
}

export const athleteStatusLabels: Record<AthleteStatusKey, string> = {
  active: "Активный",
  inactive: "Не тренируется",
  graduated: "Выпустился",
  transferred: "Переведён",
  expelled: "Отчислен",
};

export async function fetchAthletes(params: {
  page?: number;
  perPage?: number;
  centerId?: string | null;
  coachId?: string | null;
} = {}): Promise<{ items: AthleteDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage ?? 1000));
  if (params.centerId) qs.set("center_id", params.centerId);
  if (params.coachId) qs.set("coach_id", params.coachId);
  const query = qs.size ? `?${qs.toString()}` : "";
  const [items, total] = await apiFetch<[AthleteDto[], number]>(`/athletes${query}`);
  return { items, total };
}

export async function createAthlete(payload: AthleteCreatePayload): Promise<AthleteDto> {
  return apiFetch<AthleteDto>("/athletes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAthlete(
  athleteId: string,
  payload: AthleteUpdatePayload,
): Promise<AthleteDto> {
  return apiFetch<AthleteDto>(`/athletes/${athleteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAthlete(athleteId: string): Promise<void> {
  await apiFetch(`/athletes/${athleteId}`, { method: "DELETE" });
}