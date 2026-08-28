import { apiFetch } from "@/lib/api/client";
import type { Plan, PlanCategoryId, PlanItem, PlanStatus } from "@/lib/mock-data";

export const monthOptions = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const monthOrder = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export const monthToQuarter: Record<string, number> = {
  "Январь": 1, "Февраль": 1, "Март": 1,
  "Апрель": 2, "Май": 2, "Июнь": 2,
  "Июль": 3, "Август": 3, "Сентябрь": 3,
  "Октябрь": 4, "Ноябрь": 4, "Декабрь": 4,
};

export const quarterName: Record<number, string> = {
  1: "I квартал", 2: "II квартал", 3: "III квартал", 4: "IV квартал",
};

export function monthNumber(name: string): number {
  return monthOptions.indexOf(name) + 1;
}

export function monthName(n: number): string {
  return monthOptions[n - 1] ?? String(n);
}

function fmtDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString("ru-RU");
}

interface ApiPlanItem {
  id: string;
  plan_id: string;
  category: string;
  quarter: number;
  month: number;
  date: string;
  name: string;
  description: string | null;
  location: string | null;
  participants_category: string | null;
  participants_count: string | null;
  status: string;
  reviewer_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_id: string | null;
}

interface ApiPlan {
  id: string;
  coach_id: string;
  coach_user_id: string | null;
  coach_name: string;
  coach_initials: string;
  discipline: string;
  center_id: string;
  center_name: string;
  program_id: string | null;
  year: number;
  status: string;
  review_comment: string | null;
  created_at: string | null;
  items: ApiPlanItem[];
}

function toItem(a: ApiPlanItem): PlanItem {
  return {
    id: a.id,
    categoryId: a.category as PlanCategoryId,
    quarter: a.quarter,
    month: monthName(a.month),
    date: a.date,
    name: a.name,
    description: a.description ?? "",
    location: a.location ?? "",
    participantsCategory: a.participants_category ?? "",
    participantsCount: a.participants_count ?? "",
    status: a.status as PlanStatus,
    submittedAt: fmtDate(a.submitted_at),
    reviewedAt: fmtDate(a.reviewed_at),
    reviewerComment: a.reviewer_comment ?? undefined,
  };
}

export function apiPlanToLocal(a: ApiPlan): Plan {
  return {
    id: a.id,
    coachId: a.coach_user_id ?? a.coach_id,
    coachName: a.coach_name,
    coachInitials: a.coach_initials,
    discipline: a.discipline,
    centerId: a.center_id,
    year: a.year,
    periodLabel: `${a.year} год`,
    items: a.items.map(toItem),
    status: a.status as PlanStatus,
    reviewerComment: a.review_comment ?? undefined,
    createdAt: fmtDate(a.created_at) ?? "",
  };
}

export async function fetchPlans(params: { centerId?: string | null; year?: number } = {}): Promise<Plan[]> {
  const qs = new URLSearchParams();
  if (params.centerId) qs.set("center_id", params.centerId);
  if (params.year) qs.set("year", String(params.year));
  const query = qs.size ? `?${qs.toString()}` : "";
  const data = await apiFetch<ApiPlan[]>(`/incentive/plans${query}`);
  return data.map(apiPlanToLocal);
}

export async function ensurePlan(year: number): Promise<Plan> {
  const data = await apiFetch<ApiPlan>("/incentive/plans", {
    method: "POST",
    body: JSON.stringify({ year }),
  });
  return apiPlanToLocal(data);
}

export interface PlanMetaUpdatePayload {
  year?: number;
  programId?: string;
}

export async function updatePlan(
  planId: string,
  payload: PlanMetaUpdatePayload,
): Promise<Plan> {
  const data = await apiFetch<ApiPlan>(`/incentive/plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify({
      year: payload.year,
      program_id: payload.programId,
    }),
  });
  return apiPlanToLocal(data);
}

export async function deletePlan(planId: string): Promise<void> {
  await apiFetch(`/incentive/plans/${planId}`, { method: "DELETE" });
}

export interface PlanItemFormPayload {
  category: PlanCategoryId;
  quarter: number;
  month: number;
  date: string;
  name: string;
  description?: string;
  location?: string;
  participantsCategory?: string;
  participantsCount?: string;
}

export async function addPlanItem(planId: string, payload: PlanItemFormPayload): Promise<PlanItem> {
  const data = await apiFetch<ApiPlanItem>(`/incentive/plans/${planId}/items`, {
    method: "POST",
    body: JSON.stringify({
      category: payload.category,
      quarter: payload.quarter,
      month: payload.month,
      date: payload.date,
      name: payload.name,
      description: payload.description,
      location: payload.location,
      participants_category: payload.participantsCategory,
      participants_count: payload.participantsCount,
    }),
  });
  return toItem(data);
}

export async function updatePlanItem(itemId: string, payload: PlanItemFormPayload): Promise<PlanItem> {
  const data = await apiFetch<ApiPlanItem>(`/incentive/plans/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({
      category: payload.category,
      quarter: payload.quarter,
      month: payload.month,
      date: payload.date,
      name: payload.name,
      description: payload.description,
      location: payload.location,
      participants_category: payload.participantsCategory,
      participants_count: payload.participantsCount,
    }),
  });
  return toItem(data);
}

export async function submitPlanItem(itemId: string): Promise<void> {
  await apiFetch(`/incentive/plans/items/${itemId}/submit`, { method: "POST" });
}

export async function approvePlanItem(itemId: string): Promise<void> {
  await apiFetch(`/incentive/plans/items/${itemId}/approve`, { method: "POST" });
}

export async function rejectPlanItem(itemId: string, comment: string): Promise<void> {
  await apiFetch(`/incentive/plans/items/${itemId}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function redraftPlanItem(itemId: string): Promise<void> {
  await apiFetch(`/incentive/plans/items/${itemId}/redraft`, { method: "POST" });
}

export async function deletePlanItem(itemId: string): Promise<void> {
  await apiFetch(`/incentive/plans/items/${itemId}`, { method: "DELETE" });
}