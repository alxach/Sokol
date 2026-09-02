import { apiFetch } from "@/lib/api/client";

export type TrainingStatus = "proposed" | "confirmed" | "cancelled";

export const TRAINING_TITLE = "Тренировка с сотрудниками РУСАЛа";

export interface TrainingDto {
  id: string;
  center_id: string;
  center_name: string;
  coach_id: string | null;
  coach_name: string;
  coach_user_id: string | null;
  date: string;
  start_time: string;
  location: string;
  participants_count: number | null;
  goal: string | null;
  status: TrainingStatus;
  plan_item_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export interface TrainingCreatePayload {
  date: string;
  start_time: string;
  location: string;
  center_id?: string;
}

export interface TrainingUpdatePayload {
  date?: string;
  start_time?: string;
  location?: string;
}

export interface TrainingSelectPayload {
  goal: string;
}

export interface TrainingListParams {
  center_id?: string;
  date_from?: string;
  date_to?: string;
  status?: TrainingStatus | string;
  coach_id?: string;
  page?: number;
  per_page?: number;
}

export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseDate(value: string): Date | null {
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
  const d = typeof value === "string" ? parseDate(value) : value;
  return d ? isoDate(d) : "";
}

export function fmtTime(t: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1]}:${m[2]}` : t;
}

export async function fetchTrainings(params: TrainingListParams = {}): Promise<TrainingDto[]> {
  const qs = new URLSearchParams();
  if (params.center_id) qs.set("center_id", params.center_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.status) qs.set("status", params.status);
  if (params.coach_id) qs.set("coach_id", params.coach_id);
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page ?? 200));
  const query = qs.size ? `?${qs.toString()}` : "";
  return apiFetch<TrainingDto[]>(`/trainings${query}`);
}

export async function createTraining(payload: TrainingCreatePayload): Promise<TrainingDto> {
  return apiFetch<TrainingDto>("/trainings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTraining(
  trainingId: string,
  payload: TrainingUpdatePayload,
): Promise<TrainingDto> {
  return apiFetch<TrainingDto>(`/trainings/${trainingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await apiFetch(`/trainings/${trainingId}`, { method: "DELETE" });
}

export async function selectTraining(
  trainingId: string,
  payload: TrainingSelectPayload,
): Promise<TrainingDto> {
  return apiFetch<TrainingDto>(`/trainings/${trainingId}/select`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelTraining(trainingId: string): Promise<TrainingDto> {
  return apiFetch<TrainingDto>(`/trainings/${trainingId}/cancel`, {
    method: "POST",
  });
}

export async function setTrainingAttendance(
  trainingId: string,
  participants_count: number,
): Promise<TrainingDto> {
  return apiFetch<TrainingDto>(`/trainings/${trainingId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ participants_count }),
  });
}
