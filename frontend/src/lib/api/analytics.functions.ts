import { apiFetch } from "@/lib/api/client";

export interface AnalyticsKpisDto {
  athletes: number;
  coaches: number;
  competitions: number;
  medals: { gold: number; silver: number; bronze: number };
}

export interface AnalyticsSliceDto {
  name: string;
  value: number;
}

export interface CoachWorkloadDto {
  name: string;
  athletes: number;
}

export interface MedalDynamicDto {
  month: string;
  gold: number;
  silver: number;
  bronze: number;
}

export interface TopAthleteDto {
  name: string;
  discipline: string | null;
  rank: string | null;
  medals: { gold: number; silver: number; bronze: number };
  points: number;
}

export interface AnalyticsSummaryDto {
  kpis: AnalyticsKpisDto;
  athletes_by_status: AnalyticsSliceDto[];
  athletes_by_discipline: AnalyticsSliceDto[];
  coach_workload: CoachWorkloadDto[];
  medal_dynamics: MedalDynamicDto[];
  top_athletes: TopAthleteDto[];
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummaryDto> {
  return apiFetch<AnalyticsSummaryDto>("/analytics/summary");
}