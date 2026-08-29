import { apiFetch } from "@/lib/api/client";

export type AttendanceStatus = "present" | "absent" | "excused";

export interface AttendanceJournalRowAthlete {
  athlete_id: string;
  athlete_name: string;
  rank: string | null;
  status: AttendanceStatus | null;
  record_id: string | null;
  absence_reason: string | null;
}

export interface AttendanceJournalItemDto {
  schedule_id: string;
  group_id: string;
  group_name: string;
  discipline: string | null;
  coach_name: string | null;
  room: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  athletes: AttendanceJournalRowAthlete[];
}

export interface AttendanceRecordDto {
  id: string;
  athlete_id: string;
  schedule_id: string | null;
  group_id: string | null;
  date: string;
  status: AttendanceStatus;
  absence_reason: string | null;
  check_in_time: string | null;
  check_in_method: string | null;
  checked_by: string | null;
  athlete_name: string | null;
  rank: string | null;
  group_name: string | null;
  discipline: string | null;
  coach_name: string | null;
}

export interface AttendanceListResponse {
  items: AttendanceRecordDto[];
  total: number;
}

export interface AttendanceMarkPayload {
  athlete_id: string;
  schedule_id?: string;
  date: string;
  status: AttendanceStatus;
  absence_reason?: string;
}

export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseAttendanceDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (ru) {
    const [, d, m, y] = ru;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function toApiDate(value: Date | string): string {
  const d = typeof value === "string" ? parseAttendanceDate(value) : value;
  return d ? isoDate(d) : "";
}

export async function fetchAttendanceJournal(
  date: string,
  coachUserId?: string,
): Promise<AttendanceJournalItemDto[]> {
  const query = new URLSearchParams({ date });
  if (coachUserId) query.set("coach_user_id", coachUserId);
  return apiFetch<AttendanceJournalItemDto[]>(`/attendance/journal?${query.toString()}`);
}

export async function fetchAttendance(
  params: {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    groupId?: string;
    coachUserId?: string;
    centerId?: string;
    page?: number;
    perPage?: number;
  } = {},
): Promise<AttendanceListResponse> {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.dateFrom) qs.set("date_from", params.dateFrom);
  if (params.dateTo) qs.set("date_to", params.dateTo);
  if (params.groupId) qs.set("group_id", params.groupId);
  if (params.coachUserId) qs.set("coach_user_id", params.coachUserId);
  if (params.centerId) qs.set("center_id", params.centerId);
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage ?? 500));
  const query = qs.size ? `?${qs.toString()}` : "";
  return apiFetch<AttendanceListResponse>(`/attendance${query}`);
}

export async function markAttendance(
  payload: AttendanceMarkPayload,
): Promise<AttendanceRecordDto> {
  return apiFetch<AttendanceRecordDto>("/attendance/mark", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function batchAttendance(
  payload: {
    group_id: string;
    schedule_id?: string;
    date: string;
    records: { athlete_id: string; status: AttendanceStatus; absence_reason?: string }[];
  },
): Promise<AttendanceRecordDto[]> {
  return apiFetch<AttendanceRecordDto[]>("/attendance/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAttendance(
  recordId: string,
  payload: { status?: AttendanceStatus; absence_reason?: string },
): Promise<AttendanceRecordDto> {
  return apiFetch<AttendanceRecordDto>(`/attendance/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAttendanceRecord(recordId: string): Promise<void> {
  await apiFetch(`/attendance/${recordId}`, { method: "DELETE" });
}