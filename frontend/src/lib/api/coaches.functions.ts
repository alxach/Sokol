import { apiFetch } from "@/lib/api/client";

export interface CoachVacationDto {
  id: string;
  start_date: string;
  end_date: string;
}

export interface CoachDto {
  id: string;
  user_id: string;
  center_id: string | null;
  specialization: string;
  qualification: string | null;
  biography: string | null;
  hire_date: string;
  is_active: boolean;
  name: string;
  center_name: string | null;
  center_city: string | null;
  groups_count: number;
  athletes_count: number;
  vacations: CoachVacationDto[];
  sick_leaves: CoachVacationDto[];
}

export interface CoachLeaveEntry {
  start_date: string;
  end_date: string;
}

export interface CoachCreatePayload {
  user_id: string;
  center_id?: string | null;
  specialization: string;
  qualification?: string | null;
  biography?: string | null;
  hire_date: string;
  is_active?: boolean;
  vacations?: CoachLeaveEntry[];
  sick_leaves?: CoachLeaveEntry[];
}

export interface CoachUpdatePayload {
  specialization?: string;
  qualification?: string | null;
  biography?: string | null;
  is_active?: boolean;
  vacations?: CoachLeaveEntry[];
  sick_leaves?: CoachLeaveEntry[];
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

export async function createCoach(payload: CoachCreatePayload): Promise<CoachDto> {
  return apiFetch<CoachDto>("/coaches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCoach(
  coachId: string,
  payload: CoachUpdatePayload,
): Promise<CoachDto> {
  return apiFetch<CoachDto>(`/coaches/${coachId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function coachIsOnVacation(vacations: CoachLeaveEntry[]): boolean {
  return isBetweenToday(vacations);
}

export function coachIsOnSickLeave(sickLeaves: CoachLeaveEntry[]): boolean {
  return isBetweenToday(sickLeaves);
}

function isBetweenToday(periods: CoachLeaveEntry[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return periods.some((p) => {
    const start = new Date(`${p.start_date}T00:00:00`);
    const end = new Date(`${p.end_date}T00:00:00`);
    return start <= today && today <= end;
  });
}

export function coachStatusTitle(coach: CoachDto): string {
  if (!coach.is_active) return "Архив";
  if (coachIsOnSickLeave(coach.sick_leaves)) return "На больничном";
  if (coachIsOnVacation(coach.vacations)) return "Отпуск";
  return "Активный";
}