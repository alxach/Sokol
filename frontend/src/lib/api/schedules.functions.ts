import { apiFetch } from "@/lib/api/client";

export interface ScheduleAbsenceDto {
  type: "vacation" | "sick";
  start_date: string;
  end_date: string;
}

export interface SchedulePeriodDto {
  id: string;
  group_id: string;
  coach_id: string | null;
  center_id: string | null;
  group_name: string | null;
  coach_name: string | null;
  coach_user_id: string | null;
  discipline: string | null;
  period_start: string;
  period_end: string;
  status: "draft" | "active" | "archived";
  created_at: string | null;
  lesson_count: number;
  absences: ScheduleAbsenceDto[];
  items?: ScheduleItemDto[];
}

export interface ScheduleItemDto {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  location: string | null;
}

export interface SchedulePeriodCreatePayload {
  group_id: string;
  period_start: string;
  period_end: string;
}

export interface ScheduleItemPayload {
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
}

export interface SchedulePeriodListResponse {
  items: SchedulePeriodDto[];
  total: number;
  page: number;
  per_page: number;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parsePeriodDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split(".").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function addYears(dateStr: string, years: number): string {
  const d = parsePeriodDate(dateStr) ?? new Date();
  d.setFullYear(d.getFullYear() + years);
  return isoDate(d);
}

export async function fetchSchedulePeriods(
  params: {
    group_id?: string;
    coach_user_id?: string;
    center_id?: string;
    status?: string;
  } = {},
): Promise<SchedulePeriodDto[]> {
  const query = new URLSearchParams();
  if (params.group_id) query.set("group_id", params.group_id);
  if (params.coach_user_id) query.set("coach_user_id", params.coach_user_id);
  if (params.center_id) query.set("center_id", params.center_id);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  const data = await apiFetch<SchedulePeriodListResponse>(
    `/schedules/periods${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function fetchSchedulePeriod(
  periodId: string,
): Promise<SchedulePeriodDto> {
  return apiFetch<SchedulePeriodDto>(`/schedules/periods/${periodId}`);
}

export async function createSchedulePeriod(
  payload: SchedulePeriodCreatePayload,
): Promise<SchedulePeriodDto> {
  return apiFetch<SchedulePeriodDto>("/schedules/periods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSchedulePeriod(
  periodId: string,
  payload: { period_start?: string; period_end?: string },
): Promise<SchedulePeriodDto> {
  return apiFetch<SchedulePeriodDto>(`/schedules/periods/${periodId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function archiveSchedulePeriod(periodId: string): Promise<void> {
  await apiFetch(`/schedules/periods/${periodId}`, { method: "DELETE" });
}

export async function approveSchedulePeriod(
  periodId: string,
): Promise<SchedulePeriodDto> {
  return apiFetch<SchedulePeriodDto>(`/schedules/periods/${periodId}/approve`, {
    method: "POST",
  });
}

export async function duplicateSchedulePeriod(
  periodId: string,
): Promise<SchedulePeriodDto> {
  return apiFetch<SchedulePeriodDto>(
    `/schedules/periods/${periodId}/duplicate`,
    { method: "POST" },
  );
}

export async function createScheduleItem(
  periodId: string,
  payload: ScheduleItemPayload,
): Promise<ScheduleItemDto> {
  return apiFetch<ScheduleItemDto>(`/schedules/periods/${periodId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateScheduleItem(
  scheduleId: string,
  payload: Partial<ScheduleItemPayload>,
): Promise<ScheduleItemDto> {
  return apiFetch<ScheduleItemDto>(`/schedules/periods/items/${scheduleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteScheduleItem(scheduleId: string): Promise<void> {
  await apiFetch(`/schedules/periods/items/${scheduleId}`, { method: "DELETE" });
}