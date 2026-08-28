import { apiFetch } from "@/lib/api/client";

export interface Center {
  id: string;
  name: string;
  region_id: string | null;
  address: string | null;
  city: string | null;
  center_type: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

export async function fetchCenters(): Promise<Center[]> {
  return apiFetch<Center[]>("/organizations/centers");
}