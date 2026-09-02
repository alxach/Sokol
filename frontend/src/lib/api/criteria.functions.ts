import { apiFetch } from "@/lib/api/client";

export type CoachTier = "full" | "basic";

export interface IncentiveCriteria {
  id: string;
  center_id: string;
  center_name: string;
  athletes_full: number;
  athletes_basic: number;
  hours_full: number;
  hours_basic: number;
  social_events_full: number;
  social_events_basic: number;
  sports_events_full: number;
  sports_events_basic: number;
  development_events_full: number;
  development_events_basic: number;
  assigned_tier: CoachTier | null;
}

export interface CoachTierRecord {
  coach_id: string;
  user_id: string;
  coach_name: string;
  specialization: string;
  tier: CoachTier | null;
  updated_at: string | null;
}

export interface IncentiveCriteriaPayload {
  athletes_full: number;
  athletes_basic: number;
  hours_full: number;
  hours_basic: number;
  social_events_full: number;
  social_events_basic: number;
  sports_events_full: number;
  sports_events_basic: number;
  development_events_full: number;
  development_events_basic: number;
}

export const DEFAULT_CRITERIA: IncentiveCriteriaPayload = {
  athletes_full: 30,
  athletes_basic: 15,
  hours_full: 9,
  hours_basic: 4.5,
  social_events_full: 1,
  social_events_basic: 1,
  sports_events_full: 1,
  sports_events_basic: 1,
  development_events_full: 1,
  development_events_basic: 1,
};

export async function fetchCriteria(centerId?: string | null): Promise<IncentiveCriteria[]> {
  const qs = centerId ? `?center_id=${encodeURIComponent(centerId)}` : "";
  return apiFetch<IncentiveCriteria[]>(`/incentive/criteria${qs}`);
}

export async function saveCriteria(
  centerId: string,
  payload: IncentiveCriteriaPayload,
): Promise<IncentiveCriteria> {
  return apiFetch<IncentiveCriteria>(`/incentive/criteria/${centerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchCoachTiers(centerId?: string | null): Promise<CoachTierRecord[]> {
  const qs = centerId ? `?center_id=${encodeURIComponent(centerId)}` : "";
  return apiFetch<CoachTierRecord[]>(`/incentive/coach-tiers${qs}`);
}

export async function setCoachTier(
  coachId: string,
  tier: CoachTier,
): Promise<CoachTierRecord> {
  return apiFetch<CoachTierRecord>(`/incentive/coach-tiers/${coachId}`, {
    method: "PUT",
    body: JSON.stringify({ tier }),
  });
}