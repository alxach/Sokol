export type Discipline = "Дзюдо" | "Самбо" | "Бокс" | "ММА" | "Борьба";
export type AthleteStatus = "Активный" | "Травма" | "Резерв";

export interface Athlete {
  id: string;
  name: string;
  discipline: Discipline;
  rank: string;
  age: number;
  city: string;
  coach: string;
  groupId?: string;
  status: AthleteStatus;
  medals: { gold: number; silver: number; bronze: number };
  rating: number;
  lastEvent: string;
}

export const athletes: Athlete[] = [
  { id: "SK-0421", name: "Иван Соколов", discipline: "Дзюдо", rank: "МСМК", age: 24, city: "Москва", coach: "Петров А.В.", groupId: "GRP-001", status: "Активный", medals: { gold: 12, silver: 4, bronze: 2 }, rating: 1842, lastEvent: "ЧР 2025" },
  { id: "SK-0388", name: "Мария Орлова", discipline: "Самбо", rank: "МС", age: 22, city: "Санкт-Петербург", coach: "Иванова Е.С.", status: "Активный", medals: { gold: 8, silver: 6, bronze: 3 }, rating: 1714, lastEvent: "Кубок мира" },
  { id: "SK-0512", name: "Дмитрий Беркут", discipline: "Бокс", rank: "МСМК", age: 26, city: "Казань", coach: "Сидоров П.Н.", groupId: "GRP-003", status: "Активный", medals: { gold: 15, silver: 2, bronze: 1 }, rating: 1956, lastEvent: "Олимпиада" },
  { id: "SK-0467", name: "Анна Кречет", discipline: "ММА", rank: "МС", age: 27, city: "Екатеринбург", coach: "Орлов Д.А.", status: "Травма", medals: { gold: 6, silver: 5, bronze: 4 }, rating: 1602, lastEvent: "Fight Nights" },
  { id: "SK-0501", name: "Сергей Ястребов", discipline: "Борьба", rank: "МС", age: 23, city: "Махачкала", coach: "Магомедов Р.А.", status: "Активный", medals: { gold: 9, silver: 3, bronze: 2 }, rating: 1788, lastEvent: "ЧЕ 2025" },
  { id: "SK-0299", name: "Екатерина Ласточкина", discipline: "Дзюдо", rank: "КМС", age: 20, city: "Новосибирск", coach: "Петров А.В.", groupId: "GRP-002", status: "Резерв", medals: { gold: 4, silver: 7, bronze: 5 }, rating: 1488, lastEvent: "Первенство" },
  { id: "SK-0445", name: "Артём Грачёв", discipline: "Самбо", rank: "МСМК", age: 28, city: "Москва", coach: "Иванова Е.С.", status: "Активный", medals: { gold: 14, silver: 3, bronze: 1 }, rating: 1901, lastEvent: "ЧМ 2025" },
  { id: "SK-0533", name: "Ольга Чайка", discipline: "Бокс", rank: "МС", age: 21, city: "Краснодар", coach: "Сидоров П.Н.", groupId: "GRP-003", status: "Активный", medals: { gold: 7, silver: 4, bronze: 3 }, rating: 1655, lastEvent: "Кубок России" },
  { id: "SK-0610", name: "Виктор Стриж", discipline: "ММА", rank: "МСМК", age: 29, city: "Москва", coach: "Орлов Д.А.", status: "Активный", medals: { gold: 18, silver: 2, bronze: 0 }, rating: 2014, lastEvent: "PFL" },
  { id: "SK-0357", name: "Никита Орлан", discipline: "Борьба", rank: "КМС", age: 19, city: "Уфа", coach: "Магомедов Р.А.", status: "Резерв", medals: { gold: 3, silver: 5, bronze: 4 }, rating: 1422, lastEvent: "Первенство" },
];

export const monthlyResults = [
  { month: "Янв", gold: 4, silver: 6, bronze: 3 },
  { month: "Фев", gold: 6, silver: 4, bronze: 5 },
  { month: "Мар", gold: 8, silver: 7, bronze: 4 },
  { month: "Апр", gold: 5, silver: 9, bronze: 6 },
  { month: "Май", gold: 11, silver: 6, bronze: 7 },
  { month: "Июн", gold: 9, silver: 8, bronze: 5 },
  { month: "Июл", gold: 13, silver: 5, bronze: 8 },
  { month: "Авг", gold: 14, silver: 7, bronze: 6 },
];

export const disciplineMix = [
  { name: "Дзюдо", value: 28, color: "var(--color-chart-1)" },
  { name: "Самбо", value: 22, color: "var(--color-chart-2)" },
  { name: "Бокс", value: 18, color: "var(--color-chart-3)" },
  { name: "ММА", value: 16, color: "var(--color-chart-4)" },
  { name: "Борьба", value: 16, color: "var(--color-chart-5)" },
];

export const recentActivity = [
  { id: 1, who: "Дмитрий Беркут", action: "выиграл золото", target: "Олимпиада", time: "2 ч назад", tone: "gold" as const },
  { id: 2, who: "Анна Кречет", action: "переведена в статус", target: "Травма", time: "5 ч назад", tone: "warn" as const },
  { id: 3, who: "Тренер Петров А.В.", action: "загрузил отчёт", target: "Сборы Кисловодск", time: "вчера", tone: "info" as const },
  { id: 4, who: "Иван Соколов", action: "подтвердил участие", target: "ЧР 2026", time: "вчера", tone: "info" as const },
  { id: 5, who: "Мария Орлова", action: "обновила медкарту", target: "—", time: "2 дня", tone: "info" as const },
];

export type CoachStatus = "Активный" | "Отпуск" | "На больничном";

export interface VacationPeriod {
  start: string;
  end: string;
}

function inPeriod(period: VacationPeriod): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(period.start + "T00:00:00");
  const end = new Date(period.end + "T00:00:00");
  const actualEnd = end < start ? start : end;
  return today >= start && today <= actualEnd;
}

export function isOnVacation(vacations: VacationPeriod[] | undefined): boolean {
  if (!vacations || vacations.length === 0) return false;
  return vacations.some(inPeriod);
}

export function isOnSickLeave(sickLeaves: VacationPeriod[] | undefined): boolean {
  if (!sickLeaves || sickLeaves.length === 0) return false;
  return sickLeaves.some(inPeriod);
}

export function getCoachStatus(coach: Coach): CoachStatus {
  if (isOnSickLeave(coach.sickLeaves)) return "На больничном";
  if (isOnVacation(coach.vacations)) return "Отпуск";
  return coach.status;
}

export interface Coach {
  id: string;
  name: string;
  disciplines: Discipline[];
  groups: number;
  athletes: number;
  workload: number;
  rating: number;
  efficiency: number;
  status: CoachStatus;
  city: string;
  experience: number;
  email?: string;
  phone?: string;
  telegram?: string;
  rank?: string;
  education?: string;
  vacations?: VacationPeriod[];
  sickLeaves?: VacationPeriod[];
  notes?: string;
}

export const coaches: Coach[] = [
  { id: "TR-001", name: "Петров Александр Владимирович", disciplines: ["Дзюдо"], groups: 4, athletes: 24, workload: 88, rating: 1842, efficiency: 92, status: "Активный", city: "Москва", experience: 14, email: "petrov@sokol.ru", phone: "+7 (495) 111-22-33", telegram: "@petrov_av", rank: "Заслуженный тренер России", education: "РГУФКСМиТ, 2005", vacations: [{ start: "2026-07-01", end: "2026-07-14" }, { start: "2026-12-25", end: "2027-01-10" }], sickLeaves: [{ start: "2026-06-20", end: "2026-06-22" }], notes: "Ветеран труда. Член судейской коллегии Федерации дзюдо России. Регулярно повышает квалификацию на курсах в РГУФКСМиТ." },
  { id: "TR-002", name: "Иванова Елена Сергеевна", disciplines: ["Самбо"], groups: 3, athletes: 18, workload: 75, rating: 1714, efficiency: 85, status: "Активный", city: "Санкт-Петербург", experience: 10, email: "ivanova@sokol.ru", phone: "+7 (812) 222-33-44", telegram: "@ivanova_es", rank: "Тренер высшей категории", education: "НГУ им. Лесгафта, 2012" },
  { id: "TR-003", name: "Сидоров Павел Николаевич", disciplines: ["Бокс", "ММА"], groups: 5, athletes: 30, workload: 95, rating: 1956, efficiency: 90, status: "Активный", city: "Казань", experience: 18, email: "sidorov@sokol.ru", phone: "+7 (843) 333-44-55", telegram: "@sidorov_pn", rank: "Заслуженный тренер России", education: "Поволжская ГАФКСиТ, 2004" },
  { id: "TR-004", name: "Орлов Дмитрий Анатольевич", disciplines: ["ММА"], groups: 3, athletes: 15, workload: 65, rating: 1602, efficiency: 78, status: "Активный", city: "Екатеринбург", experience: 8, email: "orlov@sokol.ru", phone: "+7 (343) 444-55-66", telegram: "@orlov_da", rank: "Тренер первой категории", education: "УрФУ, 2015" },
  { id: "TR-005", name: "Магомедов Рамазан Ахмедович", disciplines: ["Борьба", "Самбо"], groups: 4, athletes: 22, workload: 82, rating: 1788, efficiency: 88, status: "Активный", city: "Махачкала", experience: 12, email: "magomedov@sokol.ru", phone: "+7 (8722) 555-66-77", telegram: "@magomedov_ra", rank: "Тренер высшей категории", education: "ДГПУ, 2010" },
  { id: "TR-006", name: "Соколова Мария Викторовна", disciplines: ["Дзюдо", "Самбо"], groups: 3, athletes: 20, workload: 70, rating: 1488, efficiency: 82, status: "Активный", city: "Москва", experience: 6, email: "sokolova@sokol.ru", phone: "+7 (495) 666-77-88", telegram: "@sokolova_mv", rank: "Тренер второй категории", education: "РГУФКСМиТ, 2017" },
  { id: "TR-007", name: "Лебедев Владимир Игоревич", disciplines: ["Бокс"], groups: 2, athletes: 12, workload: 45, rating: 1405, efficiency: 72, status: "Активный", city: "Омск", experience: 5, email: "lebedev@sokol.ru", phone: "+7 (3812) 777-88-99", telegram: "@lebedev_vi", rank: "Тренер первой категории", education: "СибГУФК, 2018", sickLeaves: [{ start: "2026-06-01", end: "2026-06-30" }] },
  { id: "TR-008", name: "Кузнецов Андрей Борисович", disciplines: ["Дзюдо", "Борьба"], groups: 4, athletes: 28, workload: 90, rating: 1901, efficiency: 94, status: "Активный", city: "Москва", experience: 20, email: "kuznetsov@sokol.ru", phone: "+7 (495) 888-99-00", telegram: "@kuznetsov_ab", rank: "Заслуженный тренер России", education: "РГУФКСМиТ, 2002" },
  { id: "TR-009", name: "Фёдорова Анна Павловна", disciplines: ["Самбо"], groups: 2, athletes: 10, workload: 55, rating: 1422, efficiency: 80, status: "Отпуск", city: "Новосибирск", experience: 4, email: "fedorova@sokol.ru", phone: "+7 (383) 111-22-33", telegram: "@fedorova_ap", rank: "Тренер второй категории", education: "НГУ им. Лесгафта, 2019", vacations: [{ start: "2026-06-01", end: "2026-06-30" }] },
  { id: "TR-010", name: "Тищенко Григорий Алексеевич", disciplines: ["ММА", "Бокс"], groups: 4, athletes: 26, workload: 85, rating: 2014, efficiency: 96, status: "Активный", city: "Краснодар", experience: 15, email: "tischenko@sokol.ru", phone: "+7 (861) 222-33-44", telegram: "@tischenko_ga", rank: "Тренер высшей категории", education: "КГУФКСТ, 2007" },
];

export type EventLevel = "Муниципальный" | "Региональный" | "Федеральный" | "Международный";
export type EventStatus = "upcoming" | "past" | "cancelled";

export type CompetitionResult = "1 место" | "2 место" | "3 место" | "5-6 место" | "Без места";

export interface CompetitionAthlete {
  athleteId: string;
  athleteName: string;
  result?: CompetitionResult;
}

export interface Competition {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  discipline: Discipline;
  level: EventLevel;
  date: string;
  dateEnd?: string;
  city: string;
  location?: string;
  status: EventStatus;
  athletes: CompetitionAthlete[];
}

let competitionIdCounter = typeof window !== "undefined" ? Number(localStorage.getItem("sokol_comp_id_counter") ?? "8") : 8;
export function freshCompetitionId() {
  const id = `EV-${String(++competitionIdCounter).padStart(3, "0")}`;
  try { localStorage.setItem("sokol_comp_id_counter", String(competitionIdCounter)); } catch {}
  return id;
}

export function persistCompetitions() {
  try { localStorage.setItem("sokol_competitions", JSON.stringify(competitions)); } catch {}
}

export const competitions: Competition[] = [
  { id: "EV-001", coachId: "2", coachName: "Петров Александр Владимирович", title: "Кубок России по самбо", discipline: "Самбо", level: "Федеральный", date: "12 июня 2026", city: "Казань", status: "upcoming", athletes: [] },
  { id: "EV-002", coachId: "2", coachName: "Петров Александр Владимирович", title: "Первенство ЦФО · дзюдо", discipline: "Дзюдо", level: "Региональный", date: "24 июня 2026", city: "Тула", status: "upcoming", athletes: [] },
  { id: "EV-003", coachId: "3", coachName: "Вебер Александр Викторович", title: "Международный турнир ММА", discipline: "ММА", level: "Международный", date: "08 июля 2026", city: "Сочи", status: "upcoming", athletes: [] },
  { id: "EV-004", coachId: "2", coachName: "Петров Александр Владимирович", title: "Чемпионат России по боксу", discipline: "Бокс", level: "Федеральный", date: "15 мая 2026", dateEnd: "20 мая 2026", city: "Москва", status: "past", athletes: [
    { athleteId: "SK-0421", athleteName: "Иван Соколов", result: "1 место" },
    { athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", result: "2 место" },
  ]},
  { id: "EV-005", coachId: "2", coachName: "Петров Александр Владимирович", title: "Первенство города по дзюдо", discipline: "Дзюдо", level: "Муниципальный", date: "27 мая 2026", city: "Ачинск", status: "past", athletes: [
    { athleteId: "SK-0421", athleteName: "Иван Соколов", result: "1 место" },
    { athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", result: "1 место" },
  ]},
  { id: "EV-006", coachId: "3", coachName: "Вебер Александр Викторович", title: "Международный турнир по борьбе", discipline: "Борьба", level: "Международный", date: "03 апреля 2026", city: "Красноярск", status: "past", athletes: [
    { athleteId: "SK-0512", athleteName: "Дмитрий Беркут", result: "1 место" },
  ]},
  { id: "EV-007", coachId: "2", coachName: "Петров Александр Владимирович", title: "Кубок Красноярского края по самбо", discipline: "Самбо", level: "Региональный", date: "18 марта 2026", city: "Красноярск", status: "past", athletes: [
    { athleteId: "SK-0421", athleteName: "Иван Соколов", result: "1 место" },
    { athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", result: "3 место" },
  ]},
  { id: "EV-008", coachId: "3", coachName: "Вебер Александр Викторович", title: "Fight Nights — ММА", discipline: "ММА", level: "Федеральный", date: "28 февраля 2026", city: "Москва", status: "past", athletes: [] },
];

try {
  if (typeof window !== "undefined") {
    const c = localStorage.getItem("sokol_competitions");
    if (c) { const p = JSON.parse(c); competitions.length = 0; competitions.push(...p); }
  }
} catch {}

export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";

export interface ReportTemplate {
  id: string;
  name: string;
  code: string;
  type: "weekly" | "monthly";
  description: string;
  fields: ReportField[];
}

export interface ReportField {
  key: string;
  label: string;
  type: "number" | "text" | "textarea";
  norm: string;
}

export const monthlyReportTemplate: ReportTemplate = {
  id: "TPL-001",
  name: "Основной отчёт тренера",
  code: "monthly_coach_report",
  type: "monthly",
  description: "Ежемесячный отчёт тренера-преподавателя ЦСЕ. Заполняется по итогам работы за месяц.",
  fields: [
    { key: "athletes_count", label: "Кол-во занимающихся спортсменов до 21 года на безвозмездной основе", type: "number", norm: "20 человек" },
    { key: "hours_per_week", label: "Кол-во часов для занятий со спортсменами до 21 года", type: "number", norm: "6 часов в неделю" },
    { key: "special_events", label: "Мероприятия с особыми категориями населения (дети с ОВЗ, школы)", type: "textarea", norm: "Не менее 1 раза в месяц" },
    { key: "sport_events", label: "Спортивные мероприятия на развитие ЦСЕ (соревнования, сборы, мастер-классы)", type: "textarea", norm: "Не менее 1 раза в месяц" },
    { key: "development_events", label: "Мероприятия на развитие спортсменов ЦСЕ (беседы, лекции)", type: "textarea", norm: "Не менее 1 раза в месяц" },
  ],
};

export const reportTemplates: ReportTemplate[] = [monthlyReportTemplate];

export interface Report {
  id: string;
  templateId: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  sport: string;
  group: string;
  centerId: string;
  periodStart: string;
  periodEnd: string;
  data: Record<string, string | number>;
  status: ReportStatus;
  reviewerComment?: string;
  reviewerName?: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export const reports: Report[] = [
  {
    id: "RPT-001", templateId: "TPL-001",
    coachId: "2", coachName: "Аксючиц Елена Николаевна", coachInitials: "АЕ", sport: "Дзюдо", group: "Начальная подготовка", centerId: "center-1",
    periodStart: "01.05.2026", periodEnd: "31.05.2026",
    data: {
      athletes_count: 20,
      hours_per_week: 8,
      special_events: "Проведение тренировочного занятия для детей с ОВЗ. Дата: 13.05.2026, 11:00. Место: ЦСЕ «Сокол». Участников: 11 человек (дети с ограничением слуха). Цель: пропаганда ЗОЖ, изучение приёмов дзюдо.",
      sport_events: "Первенство города среди мальчиков и девочек 2016-2017 г.р. на призы Русала. Дата: 27.05.2026. Место: ЦСЕ «Сокол». Участников: 110 чел. (70 участников + 40 родителей, 15 чел. ЦСЕ).",
      development_events: "Беседа с учащимися Ачинского медицинского колледжа «Энергетик. Энергия или иллюзия». Дата: 06.05.2026, 9:00. Место: ЦСЕ «Сокол». Участников: 20 чел. (воспитанники секции дзюдо).",
    },
    status: "submitted",
    createdAt: "01.06.2026", submittedAt: "01.06.2026",
  },
  {
    id: "RPT-002", templateId: "TPL-001",
    coachId: "3", coachName: "Петров Александр Владимирович", coachInitials: "ПА", sport: "Дзюдо", group: "УТГ-1", centerId: "center-1",
    periodStart: "01.05.2026", periodEnd: "31.05.2026",
    data: {
      athletes_count: 24,
      hours_per_week: 10,
      special_events: "Мастер-класс по дзюдо для воспитанников детского дома. Дата: 15.05.2026. Участников: 25 человек.",
      sport_events: "Товарищеский турнир по дзюдо между филиалами. Дата: 22.05.2026. Участников: 45 чел. (12 чел. ЦСЕ).",
      development_events: "Лекция о спортивном питании. Дата: 12.05.2026. Участников: 18 чел.",
    },
    status: "approved",
    createdAt: "29.05.2026", submittedAt: "30.05.2026",
    reviewerName: "Иванов С.М.", reviewedAt: "31.05.2026",
  },
  {
    id: "RPT-003", templateId: "TPL-001",
    coachId: "4", coachName: "Сидоров Павел Николаевич", coachInitials: "СП", sport: "Бокс", group: "Группа начальной подготовки", centerId: "center-1",
    periodStart: "01.05.2026", periodEnd: "31.05.2026",
    data: {
      athletes_count: 30,
      hours_per_week: 12,
      special_events: "Открытая тренировка по боксу для школьников. Дата: 10.05.2026. Участников: 35 человек.",
      sport_events: "Первенство города по боксу. Дата: 20-21.05.2026. Участников: 60 чел. (18 чел. ЦСЕ).",
      development_events: "",
    },
    status: "draft",
    createdAt: "31.05.2026",
  },
  {
    id: "RPT-004", templateId: "TPL-001",
    coachId: "3", coachName: "Петров Александр Владимирович", coachInitials: "ПА", sport: "Дзюдо", group: "УТГ-2", centerId: "center-1",
    periodStart: "01.04.2026", periodEnd: "30.04.2026",
    data: {
      athletes_count: 22,
      hours_per_week: 8,
      special_events: "Не проводились",
      sport_events: "Кубок города по дзюдо. Дата: 18.04.2026. Участников: 80 чел.",
      development_events: "Беседа о вреде курения. Дата: 08.04.2026. Участников: 20 чел.",
    },
    status: "rejected",
    reviewerComment: "Не приложены сканы журналов посещаемости. Требуется доработка.",
    reviewerName: "Иванов С.М.",
    createdAt: "28.04.2026", submittedAt: "29.04.2026", reviewedAt: "02.05.2026",
  },
];

export function freshReportId() {
  const max = reports.reduce((m, r) => Math.max(m, parseInt(r.id.replace("RPT-", ""), 10)), 0);
  return `RPT-${String(max + 1).padStart(3, "0")}`;
}

export function persistReports() {
  try { localStorage.setItem("sokol_reports", JSON.stringify(reports)); } catch {}
}

try {
  if (typeof window !== "undefined") {
    const sr = localStorage.getItem("sokol_reports");
    if (sr) { const p = JSON.parse(sr); reports.length = 0; reports.push(...p); }
  }
} catch {}

export interface Group {
  id: string;
  name: string;
  discipline: Discipline;
  coachId: string;
  coachName: string;
  athleteIds: string[];
  description?: string;
}

export const groups: Group[] = [
  { id: "GRP-001", name: "Начальная подготовка", discipline: "Дзюдо", coachId: "2", coachName: "Петров А.В.", athleteIds: ["SK-0421"], description: "Группа начальной подготовки 8–10 лет. Изучение базовых приёмов дзюдо." },
  { id: "GRP-002", name: "УТГ-1", discipline: "Дзюдо", coachId: "2", coachName: "Петров А.В.", athleteIds: ["SK-0299"], description: "Учебно-тренировочная группа 1-го года обучения. Спортсмены 12–14 лет." },
  { id: "GRP-003", name: "Бокс (начальная)", discipline: "Бокс", coachId: "3", coachName: "Сидоров П.Н.", athleteIds: ["SK-0512", "SK-0533"] },
];

export interface SchedulePeriod {
  id: string;
  coachId: string;
  coachName: string;
  group: string;
  discipline: Discipline;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "active" | "archived";
  createdAt: string;
}

export function isPeriodActive(p: SchedulePeriod): boolean {
  if (p.status !== "active") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(p.periodStart + "T00:00:00");
  const end = new Date(p.periodEnd + "T00:00:00");
  return today >= start && today <= end;
}

export function getPeriodStatus(p: SchedulePeriod): SchedulePeriod["status"] {
  if (p.status === "active") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(p.periodEnd + "T00:00:00");
    if (today > end) return "archived";
  }
  return p.status;
}

export const schedulePeriods: SchedulePeriod[] = [
  { id: "SP-001", coachId: "2", coachName: "Петров А.В.", group: "Начальная подготовка", discipline: "Дзюдо", periodStart: "2026-01-01", periodEnd: "2026-08-31", status: "active", createdAt: "2025-12-20" },
  { id: "SP-002", coachId: "2", coachName: "Петров А.В.", group: "УТГ-1", discipline: "Дзюдо", periodStart: "2026-01-01", periodEnd: "2026-08-31", status: "active", createdAt: "2025-12-20" },
];

let schedulePeriodIdCounter = 2;
export function freshSchedulePeriodId() {
  return `SP-${String(++schedulePeriodIdCounter).padStart(3, "0")}`;
}

export interface Schedule {
  id: string;
  periodId: string;
  coachId: string;
  coachName: string;
  group: string;
  discipline: Discipline;
  dayOfWeek: number;
  timeStart: string;
  timeEnd: string;
  room: string;
}

let scheduleIdCounter = 6;
export function freshScheduleId() {
  return `SCH-${String(++scheduleIdCounter).padStart(3, "0")}`;
}

export const schedules: Schedule[] = [
  { id: "SCH-001", periodId: "SP-001", coachId: "2", coachName: "Петров А.В.", group: "Начальная подготовка", discipline: "Дзюдо", dayOfWeek: 1, timeStart: "09:00", timeEnd: "10:30", room: "Зал А" },
  { id: "SCH-002", periodId: "SP-001", coachId: "2", coachName: "Петров А.В.", group: "Начальная подготовка", discipline: "Дзюдо", dayOfWeek: 3, timeStart: "09:00", timeEnd: "10:30", room: "Зал А" },
  { id: "SCH-003", periodId: "SP-001", coachId: "2", coachName: "Петров А.В.", group: "Начальная подготовка", discipline: "Дзюдо", dayOfWeek: 5, timeStart: "10:00", timeEnd: "11:30", room: "Зал А" },
  { id: "SCH-004", periodId: "SP-002", coachId: "2", coachName: "Петров А.В.", group: "УТГ-1", discipline: "Дзюдо", dayOfWeek: 1, timeStart: "15:00", timeEnd: "17:00", room: "Зал Б" },
  { id: "SCH-005", periodId: "SP-002", coachId: "2", coachName: "Петров А.В.", group: "УТГ-1", discipline: "Дзюдо", dayOfWeek: 3, timeStart: "15:00", timeEnd: "17:00", room: "Зал Б" },
  { id: "SCH-006", periodId: "SP-002", coachId: "2", coachName: "Петров А.В.", group: "УТГ-1", discipline: "Дзюдо", dayOfWeek: 5, timeStart: "15:00", timeEnd: "17:00", room: "Зал Б" },
];

export type AttendanceStatus = "present" | "absent" | "excused";

export interface AttendanceRecord {
  id: string;
  scheduleId: string;
  date: string;
  athleteId: string;
  athleteName: string;
  status: AttendanceStatus;
  note?: string;
  markedByCoachId: string;
}

export const attendanceRecords: AttendanceRecord[] = [
  { id: "AT-001", scheduleId: "SCH-001", date: "02.06.2026", athleteId: "SK-0421", athleteName: "Иван Соколов", status: "present", markedByCoachId: "2" },
  { id: "AT-002", scheduleId: "SCH-001", date: "02.06.2026", athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", status: "present", markedByCoachId: "2" },
  { id: "AT-004", scheduleId: "SCH-004", date: "02.06.2026", athleteId: "SK-0421", athleteName: "Иван Соколов", status: "present", markedByCoachId: "2" },
  { id: "AT-005", scheduleId: "SCH-004", date: "02.06.2026", athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", status: "present", markedByCoachId: "2" },
  { id: "AT-007", scheduleId: "SCH-001", date: "28.05.2026", athleteId: "SK-0421", athleteName: "Иван Соколов", status: "present", markedByCoachId: "2" },
  { id: "AT-008", scheduleId: "SCH-001", date: "28.05.2026", athleteId: "SK-0299", athleteName: "Екатерина Ласточкина", status: "present", markedByCoachId: "2" },
];

export function freshAttendanceId() {
  const max = attendanceRecords.reduce((m, r) => Math.max(m, parseInt(r.id.replace("AT-", ""), 10)), 0);
  return `AT-${String(max + 1).padStart(3, "0")}`;
}

export function persistAttendanceRecords() {
  try { localStorage.setItem("sokol_attendance", JSON.stringify(attendanceRecords)); } catch {}
}

export type PlanStatus = "draft" | "submitted" | "approved" | "rejected";

export type PlanCategoryId = "3" | "4" | "5";

export const planCategories: Record<PlanCategoryId, { label: string; shortLabel: string }> = {
  "3": {
    label: "Проведение мероприятий с определёнными категориями населения",
    shortLabel: "Мероприятия с категориями населения",
  },
  "4": {
    label: "Проведение соревнований на территории ЦСЕ; учебно-тренировочных сборов; мастер-классов от чемпионов на территории ЦСЕ для спортсменов ЦСЕ",
    shortLabel: "Соревнования, УТС, мастер-классы",
  },
  "5": {
    label: "Проведение мероприятий, направленных на развитие спортсменов ЦСЕ",
    shortLabel: "Развитие спортсменов",
  },
};

export const planCategoryKeys: PlanCategoryId[] = ["3", "4", "5"];

export interface PlanItem {
  id: string;
  categoryId: PlanCategoryId;
  quarter: number;
  date: string;
  name: string;
  description: string;
  location: string;
  participantsCategory: string;
  participantsCount: string;
  month: string;
  status: PlanStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerComment?: string;
  reviewerName?: string;
}

export interface Plan {
  id: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  discipline: string;
  centerId: string;
  year: number;
  periodLabel: string;
  items: PlanItem[];
  status: PlanStatus;
  reviewerComment?: string;
  reviewerName?: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export const plans: Plan[] = [
  {
    id: "PLN-001",
    coachId: "2",
    coachName: "Вебер Александр Викторович",
    coachInitials: "ВА",
    discipline: "Бокс",
    centerId: "center-1",
    year: 2026,
    periodLabel: "2026 год",
    status: "approved",
    reviewerName: "Иванов С.М.",
    createdAt: "20.01.2026",
    submittedAt: "22.01.2026",
    reviewedAt: "25.01.2026",
    items: [
      { id: "PI-001", categoryId: "3", quarter: 1, date: "14.01.2026", month: "Январь", name: "Проведение экскурсии по ЦСЕ приглашены ученики МБОУ СШ №5", description: "Проведение экскурсии по ЦСЕ «Сокол», мастер-класс с тренером и спортсменами ЦСЕ «Сокол» для учеников МБОУ СШ №5 г.Ачинска 3\"А\" класс. Цель — привлечение к посещениям спортивной секции Бокс в ЦСЕ «Сокол» и популяризация вида спорта Бокс", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\" и ученики МБОУ СШ №5 3\"А\" класс.", participantsCount: "8 спортсменов ЦСЕ \"Сокол\" и 14 учащихся МБОУ СШ №5.", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-002", categoryId: "4", quarter: 1, date: "13.01.2026", month: "Январь", name: "Проведение спортивных мероприятий с работниками предприятий Группы компаний Русал", description: "Цель: укрепление здоровья, физическая подготовка, отработка навыков самозащиты, развитие корпоративной культуры спорта.", location: "ЦСЕ", participantsCategory: "Работники компаний Русал", participantsCount: "5", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-003", categoryId: "4", quarter: 1, date: "30.01.2026", month: "Январь", name: "Проведение на территории ЦСЕ турнира по Боксу среди спортсменов ЦСЕ \"Сокол\" и клубов г.Ачинска", description: "Проведение на территории ЦСЕ турнира по боксу среди мальчиков и девочек 2012-2013г.р. и 2014-2015г.р. Цель: Выявление лучших спортсменов, привлечение к спорту, популяризация ЦСЕ и вида спорта Бокс.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\" и приглашённых клубов г. Ачинска", participantsCount: "20 спортсменов ЦСЕ \"Сокол\" и 34 спортсмена приглашённых клубов г.Ачинска", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-004", categoryId: "5", quarter: 1, date: "21.01.2026", month: "Январь", name: "Лекция: «Оказание первой медицинской помощи при ушибе»", description: "Формат лекции: теория, лекцию проводит врач Лебедева В.Н. Цель: Формирование знаний и навыков по сохранению здоровья.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\"", participantsCount: "18", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-005", categoryId: "3", quarter: 1, date: "06.02.2026", month: "Февраль", name: "Проведение урока физкультуры и мастер-класс со спортсменами ЦСЕ \"Сокол\"", description: "Проведение урока физкультуры и мастер-класс спортсменами ЦСЕ «Сокол» для учащихся МБОУ СШ №4. Цель — Развитие физ.качеств, укрепление здоровья, изучение техники Бокса, популяризация ЦСЕ и вида спорта Бокс.", location: "Спорт.зал МБОУ СШ №4", participantsCategory: "Спортсмены ЦСЕ \"Сокол\" и ученики МБОУ СШ №4 7\"А\" класс.", participantsCount: "4 спортсмена ЦСЕ \"Сокол\" и 20 учеников МБОУ СШ №4", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-006", categoryId: "4", quarter: 1, date: "03.02.2026", month: "Февраль", name: "Проведение спортивных мероприятий с работниками предприятий Группы компаний Русал", description: "Цель: укрепление здоровья, физическая подготовка, отработка навыков самозащиты, развитие корпоративной культуры спорта.", location: "ЦСЕ", participantsCategory: "Работники компаний Русал", participantsCount: "5", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-007", categoryId: "4", quarter: 1, date: "14.02.2026", month: "Февраль", name: "Проведение мастер-класса для спортсменов ЦСЕ \"Сокол\" с мастером спорта СССР по Боксу Самойленко С.Н.", description: "Проведение мастер-класса для спортсменов ЦСЕ «Сокол» с участием мастера спорта СССР по Боксу 1989 г. Самойленко С.Н. Цель: привлечение к спорту, изучение техники Бокса, популяризация ЦСЕ и вида спорта Бокс.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\"", participantsCount: "20", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-008", categoryId: "5", quarter: 1, date: "18.02.2026", month: "Февраль", name: "Поход со спортсменами ЦСЕ \"Сокол\" в музей г.Ачинска", description: "Приобщение к культурно-массовым мероприятиям. Цель: Изучение истории г.Ачинска и страны, развитие чувства патриотизма в подрастающем поколении.", location: "Музей г.Ачинска", participantsCategory: "Спортсмены ЦСЕ \"Сокол\"", participantsCount: "20", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-009", categoryId: "3", quarter: 1, date: "11.03.2026", month: "Март", name: "Проведение экскурсии по ЦСЕ приглашены ученики МБОУ СШ №7", description: "Проведение урока физкультуры и мастер-класса со спортсменами ЦСЕ «Сокол» для учащихся МБОУ СШ №7, 5-7 классы. Цель — Развитие физ.качеств, укрепление здоровья, изучение техники Бокса, популяризация ЦСЕ и вида спорта Бокс.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\" и ученики МБОУ СШ №7 5-7 классы.", participantsCount: "20 спортсменов ЦСЕ \"Сокол\" и 30-40 учащихся МБОУ СШ №7.", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-010", categoryId: "4", quarter: 1, date: "03.03.2026", month: "Март", name: "Проведение спортивных мероприятий с работниками предприятий Группы компаний Русал", description: "Цель: укрепление здоровья, физическая подготовка, отработка навыков самозащиты, развитие корпоративной культуры спорта.", location: "ЦСЕ", participantsCategory: "Работники компаний Русал", participantsCount: "5", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-011", categoryId: "4", quarter: 1, date: "20.03.2026", month: "Март", name: "Проведение на территории ЦСЕ турнира по Боксу среди спортсменов ЦСЕ \"Сокол\" и клубов г.Ачинска", description: "Проведение на территории ЦСЕ турнира по боксу среди мальчиков и девочек 2012-2013г.р. и 2014-2015г.р. Цель: Выявление лучших спортсменов, привлечение к спорту, популяризация ЦСЕ и вида спорта Бокс.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\" и приглашённых клубов г. Ачинска", participantsCount: "30 спортсменов ЦСЕ \"Сокол\" и 30 спортсменов приглашённых клубов г.Ачинска", status: "approved", reviewedAt: "25.01.2026" },
      { id: "PI-012", categoryId: "5", quarter: 1, date: "07.03.2026", month: "Март", name: "Лекция: «Здоровое питание спортсмена»", description: "Формат лекции: теория, лекцию будут проводить студенты медицинского техникума. Цель: Развить знания о здоровом питании спортсменов.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ \"Сокол\"", participantsCount: "20", status: "approved", reviewedAt: "25.01.2026" },
    ],
  },
  {
    id: "PLN-002",
    coachId: "3",
    coachName: "Петров Александр Владимирович",
    coachInitials: "ПА",
    discipline: "Дзюдо",
    centerId: "center-1",
    year: 2026,
    periodLabel: "2026 год",
    status: "draft",
    createdAt: "01.04.2026",
    items: [
      { id: "PI-101", categoryId: "3", quarter: 2, date: "17.04.2026", month: "Апрель", name: "Экскурсия для школьников МБОУ СШ №15", description: "Проведение экскурсии по ЦСЕ, мастер-класс с тренером и спортсменами ЦСЕ «Сокол» для учеников МБОУ СШ №15 г.Ачинска 5\"А\" класс.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ и ученики", participantsCount: "10+20", status: "draft" },
    ],
  },
  {
    id: "PLN-003",
    coachId: "3",
    coachName: "Петров Александр Владимирович",
    coachInitials: "ПА",
    discipline: "Дзюдо",
    centerId: "center-1",
    year: 2026,
    periodLabel: "2026 год",
    status: "submitted",
    createdAt: "10.03.2026",
    submittedAt: "15.03.2026",
    items: [
      { id: "PI-201", categoryId: "3", quarter: 1, date: "10.01.2026", month: "Январь", name: "Мастер-класс по дзюдо для школьников", description: "Открытый урок дзюдо для учащихся начальных классов.", location: "ЦСЕ", participantsCategory: "Школьники", participantsCount: "25", status: "submitted", submittedAt: "15.03.2026" },
      { id: "PI-202", categoryId: "4", quarter: 1, date: "25.02.2026", month: "Февраль", name: "Товарищеский турнир по дзюдо", description: "Турнир между филиалами ЦСЕ.", location: "ЦСЕ", participantsCategory: "Спортсмены ЦСЕ", participantsCount: "40", status: "submitted", submittedAt: "15.03.2026" },
    ],
  },
];

export interface Center {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  athletes: number;
  coaches: number;
  groups: number;
  gold: number;
  silver: number;
  bronze: number;
  activeAthletes: number;
  avgEfficiency: number;
}

export const centers: Center[] = [
  { id: "center-1", name: "ЦСЕ «Сокол» — Москва", city: "Москва", address: "ул. Спортивная, 12", phone: "+7 (495) 111-11-11", athletes: 28, coaches: 4, groups: 7, gold: 42, silver: 18, bronze: 9, activeAthletes: 24, avgEfficiency: 90 },
  { id: "center-2", name: "ЦСЕ «Сокол» — Казань", city: "Казань", address: "ул. Батыршина, 5", phone: "+7 (843) 222-22-22", athletes: 22, coaches: 3, groups: 6, gold: 35, silver: 14, bronze: 7, activeAthletes: 18, avgEfficiency: 85 },
  { id: "center-3", name: "ЦСЕ «Сокол» — Екатеринбург", city: "Екатеринбург", address: "пр. Ленина, 88", phone: "+7 (343) 333-33-33", athletes: 15, coaches: 2, groups: 4, gold: 18, silver: 9, bronze: 6, activeAthletes: 12, avgEfficiency: 78 },
];

export function getCenterIdByCoachName(coachName: string): string {
  const lastName = coachName.split(" ")[0];
  const coach = coaches.find((c) => c.name.startsWith(lastName));
  return coach ? getCenterIdByCity(coach.city) : "center-1";
}

export function archiveOtherActivePeriods(period: SchedulePeriod) {
  for (const p of schedulePeriods) {
    if (p.id !== period.id && p.group === period.group && getPeriodStatus(p) === "active") {
      p.status = "archived";
    }
  }
}

export function persistSchedulePeriods() {
  try { localStorage.setItem("sokol_schedule_periods", JSON.stringify(schedulePeriods)); } catch {}
}
export function persistSchedules() {
  try { localStorage.setItem("sokol_schedules", JSON.stringify(schedules)); } catch {}
}
try {
  if (typeof window !== "undefined") {
    const sp = localStorage.getItem("sokol_schedule_periods");
    if (sp) { const p = JSON.parse(sp); schedulePeriods.length = 0; schedulePeriods.push(...p); }
    const sc = localStorage.getItem("sokol_schedules");
    if (sc) { const p = JSON.parse(sc); schedules.length = 0; schedules.push(...p); }
    const sa = localStorage.getItem("sokol_attendance");
    if (sa) { const p = JSON.parse(sa); attendanceRecords.length = 0; attendanceRecords.push(...p); }
  }
} catch {}

export function getCenterIdByCity(city: string): string {
  const map: Record<string, string> = {
    "Москва": "center-1",
    "Санкт-Петербург": "center-1",
    "Казань": "center-2",
    "Екатеринбург": "center-3",
    "Махачкала": "center-2",
    "Краснодар": "center-3",
    "Новосибирск": "center-3",
    "Омск": "center-3",
    "Уфа": "center-2",
  };
  return map[city] ?? "center-1";
}
