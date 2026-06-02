"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface DashboardAnalytics {
  growth_yoy: number;
  efficiency_score: number;
  regions_total: number;
  regions_above_target: number;
  top_region: { name: string; efficiency: number; athletes: number };
  athlete_growth: { month: string; value: number }[];
  region_efficiency: { name: string; efficiency: number; athletes: number }[];
  quarterly_trends: { quarter: string; attendance: number; athletes: number; efficiency: number }[];
}

interface AttendanceStats {
  today_rate: number;
  today_diff: number;
  week_rate: number;
  week_diff: number;
  month_rate: number;
  absences_total: number;
  absences_diff: number;
}

interface EventsStats {
  active_tournaments: number;
  total_participants: number;
  medals_this_year: number;
  participants_change: number;
  readiness_pct: number;
  next_event_days: number;
  next_event_name: string;
}

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string;
  birth_date: string;
  sport_type: string;
  rank: string | null;
  status: string;
  center_id: string;
  coach_id: string;
}

interface Coach {
  id: string;
  specialization: string;
  center_id: string;
  is_active: boolean;
  hire_date: string;
}

export function useDashboardAnalytics() {
  return useQuery<DashboardAnalytics>({
    queryKey: ["dashboard", "analytics"],
    queryFn: () => api.get("/analytics/dashboard"),
  });
}

export function useAttendanceStats() {
  return useQuery<AttendanceStats>({
    queryKey: ["attendance", "stats"],
    queryFn: () => api.get("/attendance/stats"),
  });
}

export function useEventsStats() {
  return useQuery<EventsStats>({
    queryKey: ["events", "stats"],
    queryFn: () => api.get("/events/stats"),
  });
}

export function useAthletesList(page = 1, perPage = 50) {
  return useQuery<[Athlete[], number]>({
    queryKey: ["athletes", "list", page, perPage],
    queryFn: () => api.get(`/athletes?page=${page}&per_page=${perPage}`),
  });
}

export function useCoachesList(page = 1, perPage = 50) {
  return useQuery<[Coach[], number]>({
    queryKey: ["coaches", "list", page, perPage],
    queryFn: () => api.get(`/coaches?page=${page}&per_page=${perPage}`),
  });
}
