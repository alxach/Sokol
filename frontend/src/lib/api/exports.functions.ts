import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";

const ruMonths = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const monthToQuarter: Record<string, number> = {
  "Январь": 1, "Февраль": 1, "Март": 1,
  "Апрель": 2, "Май": 2, "Июнь": 2,
  "Июль": 3, "Август": 3, "Сентябрь": 3,
  "Октябрь": 4, "Ноябрь": 4, "Декабрь": 4,
};

const athleteSchema = z.object({
  id: z.string(),
  name: z.string(),
  discipline: z.string(),
  rank: z.string(),
  age: z.number(),
  city: z.string(),
  coach: z.string(),
  groupId: z.string().optional(),
  status: z.string(),
  medals: z.object({ gold: z.number(), silver: z.number(), bronze: z.number() }),
  rating: z.number(),
  lastEvent: z.string(),
});

const coachSchema = z.object({
  id: z.string(),
  name: z.string(),
  disciplines: z.array(z.string()),
  groups: z.number(),
  athletes: z.number(),
  workload: z.number(),
  rating: z.number(),
  efficiency: z.number(),
  status: z.string(),
  city: z.string(),
  experience: z.number(),
});

const competitionSchema = z.object({
  id: z.string(),
  title: z.string(),
  discipline: z.string(),
  date: z.string(),
  dateEnd: z.string().optional(),
  city: z.string(),
  status: z.string(),
  level: z.string(),
  participants: z.number(),
  participantsCse: z.number(),
  organizer: z.string().optional(),
  medals: z.object({ gold: z.number(), silver: z.number(), bronze: z.number() }).optional(),
});

const planItemSchema = z.object({
  categoryId: z.string(),
  date: z.string(),
  name: z.string(),
  description: z.string(),
  location: z.string(),
  participantsCategory: z.string(),
  participantsCount: z.string(),
  month: z.string(),
});

const planSchema = z.object({
  coachName: z.string(),
  discipline: z.string(),
  periodLabel: z.string(),
  items: z.array(planItemSchema),
});

const exportSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("athletes"), data: z.array(athleteSchema) }),
  z.object({ type: z.literal("coaches"), data: z.array(coachSchema) }),
  z.object({ type: z.literal("competitions"), data: z.array(competitionSchema) }),
  z.object({ type: z.literal("plans"), data: z.array(planSchema) }),
]);

type ExportPayload = z.infer<typeof exportSchema>;

function getColWidths(headers: { header: string; key: string; width: number }[]) {
  return headers.map((h) => ({ header: h.header, key: h.key, width: h.width }));
}

async function buildAthletesExcel(data: ExportPayload & { type: "athletes" }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Спортсмены");

  const cols = [
    { header: "ID", key: "id", width: 14 },
    { header: "ФИО", key: "name", width: 26 },
    { header: "Дисциплина", key: "discipline", width: 16 },
    { header: "Разряд", key: "rank", width: 12 },
    { header: "Возраст", key: "age", width: 10 },
    { header: "Город", key: "city", width: 18 },
    { header: "Тренер", key: "coach", width: 22 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Золото", key: "gold", width: 8 },
    { header: "Серебро", key: "silver", width: 8 },
    { header: "Бронза", key: "bronze", width: 8 },
    { header: "Рейтинг", key: "rating", width: 10 },
    { header: "Последнее событие", key: "lastEvent", width: 20 },
  ];

  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.font = { bold: true, name: "Calibri", size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF467FC0" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  ws.columns = getColWidths(cols);

  for (const a of data.data) {
    ws.addRow([
      a.id, a.name, a.discipline, a.rank, a.age, a.city, a.coach, a.status,
      a.medals.gold, a.medals.silver, a.medals.bronze, a.rating, a.lastEvent,
    ]);
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: data.data.length + 1, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function buildCoachesExcel(data: ExportPayload & { type: "coaches" }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Тренеры");

  const cols = [
    { header: "ID", key: "id", width: 14 },
    { header: "ФИО", key: "name", width: 28 },
    { header: "Дисциплины", key: "disciplines", width: 22 },
    { header: "Групп", key: "groups", width: 8 },
    { header: "Спортсменов", key: "athletes", width: 14 },
    { header: "Нагрузка %", key: "workload", width: 12 },
    { header: "Рейтинг", key: "rating", width: 10 },
    { header: "Эффективность %", key: "efficiency", width: 16 },
    { header: "Статус", key: "status", width: 16 },
    { header: "Город", key: "city", width: 18 },
    { header: "Стаж (лет)", key: "experience", width: 12 },
  ];

  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.font = { bold: true, name: "Calibri", size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF467FC0" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  ws.columns = getColWidths(cols);

  for (const c of data.data) {
    ws.addRow([
      c.id, c.name, c.disciplines.join(", "), c.groups, c.athletes, c.workload,
      c.rating, c.efficiency, c.status, c.city, c.experience,
    ]);
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: data.data.length + 1, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function buildCompetitionsExcel(data: ExportPayload & { type: "competitions" }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Соревнования");

  const cols = [
    { header: "ID", key: "id", width: 14 },
    { header: "Название", key: "title", width: 36 },
    { header: "Дисциплина", key: "discipline", width: 16 },
    { header: "Дата начала", key: "date", width: 14 },
    { header: "Дата окончания", key: "dateEnd", width: 14 },
    { header: "Город", key: "city", width: 18 },
    { header: "Уровень", key: "level", width: 18 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Участников (всего)", key: "participants", width: 18 },
    { header: "Участников (ЦСЕ)", key: "participantsCse", width: 18 },
    { header: "Организатор", key: "organizer", width: 22 },
    { header: "Золото", key: "gold", width: 8 },
    { header: "Серебро", key: "silver", width: 8 },
    { header: "Бронза", key: "bronze", width: 8 },
  ];

  const headerRow = ws.addRow(cols.map((c) => c.header));
  headerRow.font = { bold: true, name: "Calibri", size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF467FC0" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  ws.columns = getColWidths(cols);

  for (const c of data.data) {
    ws.addRow([
      c.id, c.title, c.discipline, c.date, c.dateEnd ?? "", c.city, c.level, c.status,
      c.participants, c.participantsCse, c.organizer ?? "",
      c.medals?.gold ?? 0, c.medals?.silver ?? 0, c.medals?.bronze ?? 0,
    ]);
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: data.data.length + 1, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export const exportToExcel = createServerFn({ method: "POST" })
  .inputValidator(exportSchema)
  .handler(async ({ data }) => {
    let buf: Buffer;
    let filename: string;

    if (data.type === "athletes") {
      buf = await buildAthletesExcel(data);
      filename = "athletes.xlsx";
    } else if (data.type === "coaches") {
      buf = await buildCoachesExcel(data);
      filename = "coaches.xlsx";
    } else if (data.type === "competitions") {
      buf = await buildCompetitionsExcel(data);
      filename = "competitions.xlsx";
    } else {
      buf = await buildPlansExcel(data);
      filename = "plans-export.xlsx";
    }

    return { base64: buf.toString("base64"), filename };
  });

const importAthleteSchema = z.object({
  base64: z.string(),
});

export const importAthletesFromExcel = createServerFn({ method: "POST" })
  .inputValidator(importAthleteSchema)
  .handler(async ({ data }) => {
    const buf = Buffer.from(data.base64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.read(buf);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("Файл не содержит листов");

    const rows: Record<string, string>[] = [];
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => headers.push(String(cell.value ?? "").trim()));

    const colMap: Record<string, string> = {
      "фио": "name",
      "фис": "name",
      "имя": "name",
      "фамилия": "name",
      "дисциплина": "discipline",
      "вид спорта": "discipline",
      "разряд": "rank",
      "возраст": "age",
      "город": "city",
      "тренер": "coach",
      "статус": "status",
      "золото": "gold",
      "серебро": "silver",
      "бронза": "bronze",
      "рейтинг": "rating",
      "последнее событие": "lastEvent",
      "последнее мероприятие": "lastEvent",
      "id": "id",
    };

    const athleteCols: { colIdx: number; field: string }[] = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().trim();
      if (colMap[h]) {
        athleteCols.push({ colIdx: i, field: colMap[h] });
      }
    }

    if (athleteCols.length === 0) throw new Error("Не найдены колонки с данными спортсменов. Ожидаются: ФИО, Дисциплина, Разряд и т.д.");

    const requiredFields = ["name", "discipline"];
    const foundFields = athleteCols.map((c) => c.field);
    for (const rf of requiredFields) {
      if (!foundFields.includes(rf)) throw new Error(`Обязательная колонка "${rf}" не найдена`);
    }

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      for (const { colIdx, field } of athleteCols) {
        const val = row.getCell(colIdx + 1).value;
        record[field] = val != null ? String(val).trim() : "";
      }
      if (record.name) rows.push(record);
    });

    const parsed = rows.map((r, i) => ({
      tempId: i,
      name: r.name ?? "",
      discipline: r.discipline ?? "Дзюдо",
      rank: r.rank ?? "КМС",
      age: parseInt(r.age) || 0,
      city: r.city ?? "",
      coach: r.coach ?? "",
      status: r.status ?? "Активный",
      gold: parseInt(r.gold) || 0,
      silver: parseInt(r.silver) || 0,
      bronze: parseInt(r.bronze) || 0,
      rating: parseInt(r.rating) || 0,
      lastEvent: r.lastEvent ?? "",
    }));

    return { athletes: parsed };
  });

function monthEvents(items: Array<{ month: string }>): Map<string, typeof items> {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const existing = map.get(item.month) ?? [];
    existing.push(item);
    map.set(item.month, existing);
  }
  return map;
}

async function buildPlansExcel(data: { type: "plans"; data: Array<z.infer<typeof planSchema>> }) {
  const wb = new ExcelJS.Workbook();

  const headers = [
    { header: "Раздел отчета (категория мероприятия)", key: "category", width: 48 },
    { header: "Дата", key: "date", width: 22 },
    { header: "Наименование мероприятия", key: "name", width: 42 },
    { header: "Формат/содержание/цель", key: "description", width: 56 },
    { header: "Место проведения", key: "location", width: 28 },
    { header: "Категория участников", key: "participants", width: 36 },
    { header: "Количество участников", key: "count", width: 18 },
  ];

  const categoryLabel: Record<string, string> = {
    "3": "3. Проведение мероприятий с определенными категориями населения",
    "4": "4. Проведение соревнований на территории ЦСЕ; учебно-тренировочных сборов; мастер-классов от чемпионов на территории ЦСЕ для спортсменов ЦСЕ",
    "5": "5. Проведение мероприятий, направленных на развитие спортсменов ЦСЕ",
  };

  for (const plan of data.data) {
    const sheetName = plan.coachName.length > 28 ? plan.coachName.slice(0, 28) : plan.coachName;
    const ws = wb.addWorksheet(sheetName);

    ws.columns = headers.map((h) => ({ header: h.header, key: h.key, width: h.width }));

    // Row 1: Title
    const titleRow = ws.addRow(["План мероприятий тренера"]);
    titleRow.font = { bold: true, name: "Calibri", size: 14, color: { argb: "FF09234C" } };
    titleRow.height = 28;
    ws.mergeCells(`A${titleRow.number}:G${titleRow.number}`);

    // Row 2: Headers
    const headerRow = ws.addRow(headers.map((h) => h.header));
    headerRow.font = { bold: true, name: "Calibri", size: 10, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF467FC0" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 32;

    // Row 3: Coach info
    const coachRow = ws.addRow([`${plan.coachName} , вид единоборств: ${plan.discipline}.`]);
    coachRow.font = { bold: true, name: "Calibri", size: 10, color: { argb: "FF09234C" } };
    coachRow.height = 20;
    ws.mergeCells(`A${coachRow.number}:G${coachRow.number}`);

    const monthGroups = monthEvents(plan.items as any);

    for (const month of ruMonths) {
      const events = monthGroups.get(month);
      if (!events || events.length === 0) continue;

      // Month header row
      const mhRow = ws.addRow([month]);
      mhRow.font = { bold: true, name: "Calibri", size: 10, color: { argb: "FF09234C" } };
      mhRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF0F8" } };
      ws.mergeCells(`A${mhRow.number}:G${mhRow.number}`);

      for (const ev of events) {
        ws.addRow([
          categoryLabel[ev.categoryId] ?? ev.categoryId,
          ev.date,
          ev.name,
          ev.description,
          ev.location,
          ev.participantsCategory,
          ev.participantsCount,
        ]);
      }
    }

    // Signature row
    const sigRow = ws.addRow([`Тренер-преподаватель: _______________ / ${plan.coachName}`]);
    sigRow.font = { name: "Calibri", size: 10, color: { argb: "FF09234C" } };
    sigRow.height = 22;
    ws.mergeCells(`A${sigRow.number}:G${sigRow.number}`);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

const importPlanSchema = z.object({
  base64: z.string(),
});

function validatePlanDate(dateRaw: string, month: string): string[] {
  const warnings: string[] = [];
  if (!dateRaw) return warnings;

  const monthRefs: number[] = [];

  const monthMatches = dateRaw.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g);
  for (const m of monthMatches) {
    const day = parseInt(m[1]);
    const monthNum = parseInt(m[2]);
    const year = parseInt(m[3]);

    const date = new Date(year, monthNum - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== monthNum - 1 || date.getDate() !== day) {
      warnings.push(`Невалидная дата "${m[0]}"`);
    }

    monthRefs.push(monthNum);
  }

  const rangeMonthMatches = dateRaw.matchAll(/\.(\d{1,2})\.(\d{4})/g);
  for (const m of rangeMonthMatches) {
    monthRefs.push(parseInt(m[1]));
  }

  if (month && monthRefs.length > 0) {
    const monthNumFromMap = ruMonths.indexOf(month) + 1;
    if (monthNumFromMap > 0 && !monthRefs.some((mr) => mr === monthNumFromMap)) {
      warnings.push(`Даты "${dateRaw}" не соответствуют месяцу "${month}" (возможно, копипаста)`);
    }
  }

  return warnings;
}

export const importPlanFromExcel = createServerFn({ method: "POST" })
  .inputValidator(importPlanSchema)
  .handler(async ({ data }) => {
    const buf = Buffer.from(data.base64, "base64");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.read(buf);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("Файл не содержит листов");

    let coachName = "";
    let discipline = "";
    let currentMonth = "";
    const items: Array<z.infer<typeof planItemSchema>> = [];
    const warnings: string[] = [];
    let coachFound = false;

    ws.eachRow((row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell((cell) => cells.push(cell.value != null ? String(cell.value).trim() : ""));
      const nonEmpty = cells.filter((c) => c.length > 0);
      if (nonEmpty.length === 0) return;

      const firstCell = cells[0] || "";

      if (!coachFound && firstCell.includes("вид")) {
        const match = firstCell.match(/^([^,]+?)\s*,\s*вид\s+единоборств:\s*(.+?)\.?$/i);
        if (match) {
          coachName = match[1].trim();
          discipline = match[2].trim();
          coachFound = true;
        }
        return;
      }

      if (!coachFound && firstCell.includes("вид")) return;

      if (ruMonths.includes(firstCell)) {
        currentMonth = firstCell;
        return;
      }

      const vacMatch = nonEmpty.length === 1 && (firstCell.toLowerCase() === "отпуск");
      if (vacMatch) return;

      if (firstCell.includes("Тренер-преподаватель")) return;
      if (firstCell.includes("Раздел") || firstCell.includes("категория")) return;

      const catMatch = firstCell.match(/^(\d+)\.?\s*(.*)/);
      if (catMatch && ["3", "4", "5"].includes(catMatch[1])) {
        const categoryId = catMatch[1];
        const dateRaw = cells[1] || "";

        const dateWarnings = validatePlanDate(dateRaw, currentMonth);
        for (const w of dateWarnings) {
          warnings.push(`Строка ${rowNumber}: ${w}`);
        }

        items.push({
          categoryId,
          date: dateRaw,
          name: cells[2] || "",
          description: cells[3] || "",
          location: cells[4] || "",
          participantsCategory: cells[5] || "",
          participantsCount: cells[6] || "",
          month: currentMonth,
        });
      }
    });

    return { coachName, discipline, items, warnings };
  });
