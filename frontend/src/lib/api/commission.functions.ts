import { apiFetch } from "@/lib/api/client";

export type ProtocolStatus = "draft" | "approved" | "rejected";

export interface PayoutRowDto {
  id: string;
  protocol_id: string;
  coach_id: string;
  report_id: string | null;
  sport_type: string;
  period_start: string;
  period_end: string;
  gross_amount: string;
  ndfl_amount: string;
  insurance_amount: string;
  net_amount: string;
  coach_name: string;
}

export interface CommissionProtocolDto {
  id: string;
  number: string;
  date: string;
  beneficiary_name: string;
  period: string;
  center_id: string;
  center_name: string;
  agenda: string | null;
  decisions: string | null;
  voting_for: number;
  voting_against: number;
  voting_abstained: number;
  status: ProtocolStatus;
  reviewer_id: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  payout_rows: PayoutRowDto[];
}

export interface CommissionProtocolCreatePayload {
  number: string;
  date: string;
  beneficiary_name: string;
  period: string;
  center_id: string;
  agenda?: string | null;
  decisions?: string | null;
  voting_for?: number;
  voting_against?: number;
  voting_abstained?: number;
}

export interface CommissionProtocolUpdatePayload {
  number?: string;
  date?: string;
  beneficiary_name?: string;
  period?: string;
  center_id?: string;
  agenda?: string | null;
  decisions?: string | null;
  voting_for?: number;
  voting_against?: number;
  voting_abstained?: number;
}

export interface PayoutRowCreatePayload {
  coach_id: string;
  report_id?: string | null;
  sport_type: string;
  period_start: string;
  period_end: string;
  gross_amount: string;
}

export async function fetchProtocols(): Promise<CommissionProtocolDto[]> {
  return apiFetch<CommissionProtocolDto[]>("/incentive/protocols");
}

export async function fetchProtocol(protocolId: string): Promise<CommissionProtocolDto> {
  return apiFetch<CommissionProtocolDto>(`/incentive/protocols/${protocolId}`);
}

export async function createProtocol(
  payload: CommissionProtocolCreatePayload,
): Promise<CommissionProtocolDto> {
  return apiFetch<CommissionProtocolDto>("/incentive/protocols", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProtocol(
  protocolId: string,
  payload: CommissionProtocolUpdatePayload,
): Promise<CommissionProtocolDto> {
  return apiFetch<CommissionProtocolDto>(`/incentive/protocols/${protocolId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await apiFetch(`/incentive/protocols/${protocolId}`, { method: "DELETE" });
}

export async function approveProtocol(protocolId: string): Promise<CommissionProtocolDto> {
  return apiFetch<CommissionProtocolDto>(`/incentive/protocols/${protocolId}/approve`, {
    method: "POST",
  });
}

export async function rejectProtocol(
  protocolId: string,
  comment: string,
): Promise<CommissionProtocolDto> {
  return apiFetch<CommissionProtocolDto>(`/incentive/protocols/${protocolId}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function addPayoutRow(
  protocolId: string,
  payload: PayoutRowCreatePayload,
): Promise<PayoutRowDto> {
  return apiFetch<PayoutRowDto>(`/incentive/protocols/${protocolId}/payouts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPayoutRows(protocolId: string): Promise<PayoutRowDto[]> {
  return apiFetch<PayoutRowDto[]>(`/incentive/protocols/${protocolId}/payouts`);
}

export async function deletePayoutRow(protocolId: string, payoutId: string): Promise<void> {
  await apiFetch(`/incentive/protocols/${protocolId}/payouts/${payoutId}`, {
    method: "DELETE",
  });
}