import { apiFetch } from "@/lib/api/client";

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