import { apiFetch } from "@/lib/api/client";

export interface CompetitionParticipantDto {
  athlete_id: string;
  athlete_name: string;
  result: string | null;
}

export interface CompetitionChildDto {
  id: string;
  name: string;
  discipline: string;
  status: string;
  participants: CompetitionParticipantDto[];
}

export interface CompetitionDto {
  id: string;
  name: string;
  event_type: string;
  level: string | null;
  city: string | null;
  center_id: string | null;
  coach_id: string | null;
  start_date: string;
  end_date: string;
  location: string;
  description: string | null;
  status: string;
  competitions: CompetitionChildDto[];
}

export interface CompetitionCreatePayload {
  name: string;
  discipline: string;
  level: string;
  city: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
}

export interface CompetitionUpdatePayload {
  name?: string;
  discipline?: string;
  level?: string;
  city?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  description?: string;
}

export interface EventRef {
  id: string;
}

export interface CompetitionRef {
  id: string;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseDate(str: string): Date | undefined {
  if (!str) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parts = str.split(".");
  if (parts.length === 3) {
    const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

export async function fetchCompetitions(): Promise<CompetitionDto[]> {
  const data = await apiFetch<{ items: CompetitionDto[]; total: number }>(
    "/events/competitions",
  );
  return data.items;
}

export async function createCompetition(
  payload: CompetitionCreatePayload,
): Promise<{ event: EventRef; competition: CompetitionRef }> {
  const event = await apiFetch<EventRef>("/events", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      event_type: "competition",
      level: payload.level,
      city: payload.city,
      start_date: payload.start_date,
      end_date: payload.end_date,
      location: payload.location,
      description: payload.description,
    }),
  });
  const competition = await apiFetch<CompetitionRef>(`/events/${event.id}/competitions`, {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      discipline: payload.discipline,
      competition_type: "competition",
      status: "upcoming",
    }),
  });
  return { event, competition };
}

export async function updateCompetition(
  eventId: string,
  competitionId: string,
  payload: CompetitionUpdatePayload,
): Promise<void> {
  await apiFetch(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: payload.name,
      level: payload.level,
      city: payload.city,
      start_date: payload.start_date,
      end_date: payload.end_date,
      location: payload.location,
      description: payload.description,
    }),
  });
  if (payload.discipline) {
    await apiFetch(`/events/competitions/${competitionId}`, {
      method: "PATCH",
      body: JSON.stringify({ discipline: payload.discipline }),
    });
  }
}

export async function deleteCompetitionEvent(eventId: string): Promise<void> {
  await apiFetch(`/events/${eventId}`, { method: "DELETE" });
}

export async function cancelCompetition(eventId: string): Promise<void> {
  await apiFetch(`/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export async function addCompetitionParticipant(
  competitionId: string,
  athleteId: string,
): Promise<void> {
  await apiFetch(`/events/competitions/${competitionId}/participants`, {
    method: "POST",
    body: JSON.stringify({ athlete_id: athleteId }),
  });
}

export async function removeCompetitionParticipant(
  competitionId: string,
  athleteId: string,
): Promise<void> {
  await apiFetch(
    `/events/competitions/${competitionId}/participants/${athleteId}`,
    { method: "DELETE" },
  );
}

export async function setCompetitionResult(
  competitionId: string,
  athleteId: string,
  result: string,
): Promise<void> {
  await apiFetch(`/events/competitions/${competitionId}/results/${athleteId}`, {
    method: "PUT",
    body: JSON.stringify({ result }),
  });
}

export async function clearCompetitionResult(
  competitionId: string,
  athleteId: string,
): Promise<void> {
  await apiFetch(`/events/competitions/${competitionId}/results/${athleteId}`, {
    method: "DELETE",
  });
}

export { isoDate };