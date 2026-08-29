import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, VerticalAlign, convertInchesToTwip,
} from "docx";

export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";

export interface ReportFieldDto {
  key: string;
  label: string;
  type: "number" | "text" | "textarea";
  norm: string;
  confirmationForm?: "mandatory_in_report" | "on_request" | "none";
  normFull?: number | null;
  normBasic?: number | null;
  unit?: string;
}

export interface ReportTemplateDto {
  id: string;
  name: string;
  code: string;
  report_type: string;
  structure_json: { fields: ReportFieldDto[] };
  description: string | null;
}

export interface ReportDto {
  id: string;
  template_id: string;
  author_id: string;
  center_id: string | null;
  coach_id: string | null;
  program_id: string | null;
  payout_tier: number | null;
  commission_protocol_id: string | null;
  period_type: string;
  period_start: string;
  period_end: string;
  data_json: Record<string, string | number>;
  status: ReportStatus;
  reviewer_id: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  template_name: string | null;
  coach_name: string | null;
  coach_user_id: string | null;
  author_name: string | null;
  center_name: string | null;
  center_city: string | null;
  sport: string | null;
}

export interface ReportCreatePayload {
  template_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  data_json: Record<string, string | number>;
  center_id?: string;
  coach_id?: string;
}

export interface ReportUpdatePayload {
  period_type?: string;
  period_start?: string;
  period_end?: string;
  data_json?: Record<string, string | number>;
}

export async function fetchReportTemplates(): Promise<ReportTemplateDto[]> {
  return apiFetch<ReportTemplateDto[]>("/reports/templates");
}

export async function fetchReports(params: {
  page?: number;
  perPage?: number;
  centerId?: string | null;
  coachUserId?: string | null;
} = {}): Promise<{ items: ReportDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.perPage) qs.set("per_page", String(params.perPage ?? 1000));
  if (params.centerId) qs.set("center_id", params.centerId);
  if (params.coachUserId) qs.set("coach_user_id", params.coachUserId);
  const query = qs.size ? `?${qs.toString()}` : "";
  const [items, total] = await apiFetch<[ReportDto[], number]>(`/reports${query}`);
  return { items, total };
}

export async function fetchReport(reportId: string): Promise<ReportDto> {
  return apiFetch<ReportDto>(`/reports/${reportId}`);
}

export async function createReport(payload: ReportCreatePayload): Promise<ReportDto> {
  return apiFetch<ReportDto>("/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateReport(
  reportId: string,
  payload: ReportUpdatePayload,
): Promise<ReportDto> {
  return apiFetch<ReportDto>(`/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteReport(reportId: string): Promise<void> {
  await apiFetch(`/reports/${reportId}`, { method: "DELETE" });
}

export async function submitReport(reportId: string): Promise<ReportDto> {
  return apiFetch<ReportDto>(`/reports/${reportId}/submit`, { method: "POST" });
}

export async function approveReport(reportId: string): Promise<ReportDto> {
  return apiFetch<ReportDto>(`/reports/${reportId}/approve`, { method: "POST" });
}

export async function rejectReport(reportId: string, comment: string): Promise<ReportDto> {
  return apiFetch<ReportDto>(`/reports/${reportId}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

const reportDataSchema = z.object({
  reportId: z.string(),
  coachName: z.string(),
  sport: z.string(),
  group: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  status: z.string(),
  submittedAt: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewerName: z.string().optional(),
  reviewerComment: z.string().optional(),
  data: z.record(z.string(), z.union([z.string(), z.number()])),
});

type ReportData = z.infer<typeof reportDataSchema>;

const FIELD_LABELS: Record<string, string> = {
  athletes_count: "Количество занимающихся спортсменов в возрасте до 21 года на безвозмездной основе",
  hours_per_week: "Количество часов для занятий со спортсменами до 21 года (включительно) на безвозмездной основе",
  special_events: "Проведение мероприятий с определенными категориями населения, привлечение их к занятиям физкультурой и спортом по направлениям спортивных единоборств в ЦСЕ\\дошкольных, общеобразовательных учреждениях города. Повышение узнаваемости и имиджа Центра среди населения города*",
  sport_events: "Проведение спортивных мероприятий направленных на развитие ЦСЕ: соревнования на территории ЦСЕ, организаторы которых выступают тренеры; учебно-тренировочные сборы; мастер классы от чемпионов для спортсменов ЦСЕ",
  development_events: "Проведение мероприятий направленных на развитие спортсменов ЦСЕ",
};

const monthNames = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function getShortName(fullName: string): string {
  const parts = fullName.split(" ");
  if (parts.length >= 3) {
    return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
  }
  return fullName;
}

function getMonthYear(periodStart: string): { month: string; year: string } {
  const parts = periodStart.split(".");
  const monthIndex = parseInt(parts[1], 10) - 1;
  return { month: monthNames[monthIndex] ?? "?", year: parts[2] ?? "?" };
}

function line(text: string, options?: {
  bold?: boolean;
  size?: number;
  indent?: number;
}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: options?.bold ?? false,
        size: options?.size ?? 22,
        font: "Times New Roman",
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
    indent: options?.indent ? { left: options.indent } : undefined,
  });
}

function emptyLine() {
  return new Paragraph({
    children: [new TextRun({ text: "", size: 22, font: "Times New Roman" })],
    spacing: { after: 60 },
  });
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: { fill: "E8E8E8" },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

function cellParagraph(text: string, bold = false, size = 20) {
  return new Paragraph({
    children: [new TextRun({ text, bold, size, font: "Times New Roman" })],
    spacing: { before: 20, after: 20 },
  });
}

function dataCell(paragraphs: Paragraph[], width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    children: paragraphs,
    verticalAlign: VerticalAlign.TOP,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

function formatEventRow(
  value: string,
): { reportText: Paragraph[]; appendixParagraphs: Paragraph[] } {
  const text = String(value);

  const reportLines: Paragraph[] = text.split("\n").map((line) => cellParagraph(line.trim()));
  reportLines.push(cellParagraph(``, false, 20));
  reportLines.push(cellParagraph(`В подробном отчете приложить фото,`, false, 18));
  reportLines.push(cellParagraph(`скрины, ссылки на публикации в СМИ,`, false, 18));
  reportLines.push(cellParagraph(`соц. сетях`, false, 18));

  const appendixParagraphs: Paragraph[] = [
    cellParagraph(text, false, 22),
  ];

  return { reportText: reportLines, appendixParagraphs };
}

function createReportDoc(report: ReportData): Document {
  const { month, year } = getMonthYear(report.periodStart);
  const shortName = getShortName(report.coachName);

  const appendixPreamble = "Приложение к Отчету тренера за";
  const periodLabel = `${report.periodStart} – ${report.periodEnd}`;

  const evalCell = (extra?: string): Paragraph[] => {
    const p: Paragraph[] = [
      cellParagraph("Выполнено/", false, 20),
      cellParagraph("не выполнено", false, 20),
      emptyLine(),
    ];
    if (extra) p.push(cellParagraph(extra, false, 18));
    p.push(cellParagraph("ФИО руководителя,", false, 18));
    p.push(cellParagraph("подпись", false, 18));
    return p;
  };

  const evalCellRow1: Paragraph[] = [
    cellParagraph("Выполнено/", false, 20),
    cellParagraph("не выполнено", false, 20),
    emptyLine(),
    cellParagraph("Приложить к отчету сканы", false, 18),
    cellParagraph("журналов посещаемости", false, 18),
    cellParagraph("ФИО руководителя,", false, 18),
    cellParagraph("подпись", false, 18),
  ];

  const mainTableHeader = () =>
    new TableRow({
      children: [
        headerCell("№", 5),
        headerCell("Наименование показателя", 42),
        headerCell("Отчет о проделанной работе", 26),
        headerCell("Оценка комиссии", 27),
      ],
    });

  const numericKeys = ["athletes_count", "hours_per_week"];
  const eventKeys = ["special_events", "sport_events", "development_events"];

  const numRows = numericKeys.map((key, i) => {
    const label = FIELD_LABELS[key];
    const val = String(report.data[key] ?? "—");
    const labelP = cellParagraph(label, true, 20);
    const isRow1 = key === "athletes_count";
    return new TableRow({
      children: [
        dataCell([cellParagraph(String(i + 1), false, 20)], 5),
        dataCell([labelP], 42),
        dataCell([cellParagraph(val, false, 20)], 26),
        dataCell(isRow1 ? evalCellRow1 : evalCell(), 27),
      ],
    });
  });

  const appendixContents: { key: string; label: string; paragraphs: Paragraph[] }[] = [];

  const eventRows = eventKeys.map((key, i) => {
    const label = FIELD_LABELS[key];
    const raw = String(report.data[key] ?? "");
    let reportParagraphs: Paragraph[];
    let appendixParagraphs: Paragraph[];

    if (raw.trim() && raw !== "—") {
      const fmt = formatEventRow(raw);
      reportParagraphs = fmt.reportText;
      appendixParagraphs = fmt.appendixParagraphs;
      appendixContents.push({ key, label: `Пункт №${i + 3}`, paragraphs: appendixParagraphs });
    } else {
      reportParagraphs = [cellParagraph("—", false, 20)];
    }

    const idx = i + 1 + numericKeys.length;
    return new TableRow({
      children: [
        dataCell([cellParagraph(String(idx), false, 20)], 5),
        dataCell([cellParagraph(label, true, 18)], 42),
        dataCell(reportParagraphs, 26),
        dataCell(evalCell(), 27),
      ],
    });
  });

  const allRows = [mainTableHeader(), ...numRows, ...eventRows];

  const docChildren: (Paragraph | Table)[] = [
    line("ОСНОВНОЙ ОТЧЕТ ТРЕНЕРА", { bold: true, size: 28 }),
    emptyLine(),
    line(`Тренер (Ф.И.О.) __________ ${report.coachName}`, { size: 22 }),
    line(`Вид спорта ${report.sport}`, { size: 22 }),
    line(`Группы ${report.group}`, { size: 22 }),
    emptyLine(),
    line(`Результаты работы за период с ${report.periodStart} г. по ${report.periodEnd} г.`, { size: 22 }),
    emptyLine(),

    new Table({
      rows: allRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
    emptyLine(),
    emptyLine(),

    line(`Тренер-преподаватель: _______________ ${shortName}`, { size: 22 }),
    line(`подпись`, { size: 20, indent: 1260 }),
    line(`ФИО`, { size: 20, indent: 1260 }),
  ];

  if (appendixContents.length > 0) {
    const { month: appMonth, year: appYear } = getMonthYear(report.periodStart);
    const appHeader = `${appendixPreamble} ${appMonth} ${appYear}г.`;

    for (const app of appendixContents) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "", size: 22, font: "Times New Roman" })],
          pageBreakBefore: true,
          spacing: { after: 0 },
        }),
      );
      docChildren.push(line(appHeader, { bold: true, size: 24 }));
      docChildren.push(emptyLine());
      docChildren.push(line(app.label, { bold: true, size: 22 }));

      const raw = String(report.data[app.key] ?? "");
      if (raw.trim()) {
        docChildren.push(emptyLine());
        docChildren.push(line(raw, { size: 22 }));
      }
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 22 },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.79),
              right: convertInchesToTwip(0.59),
              bottom: convertInchesToTwip(0.79),
              left: convertInchesToTwip(1.18),
            },
          },
        },
        children: docChildren,
      },
    ],
  });
}

export const generateReportDocx = createServerFn({ method: "POST" })
  .inputValidator(reportDataSchema)
  .handler(async ({ data }) => {
    const doc = createReportDoc(data);
    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString("base64");
    return { base64, filename: `report-${data.reportId}.docx` };
  });
