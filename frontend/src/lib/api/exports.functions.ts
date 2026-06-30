import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import ExcelJS from "exceljs";

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

const exportSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("athletes"), data: z.array(athleteSchema) }),
  z.object({ type: z.literal("coaches"), data: z.array(coachSchema) }),
  z.object({ type: z.literal("competitions"), data: z.array(competitionSchema) }),
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
    } else {
      buf = await buildCompetitionsExcel(data);
      filename = "competitions.xlsx";
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
