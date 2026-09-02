export const NO_RANK = "Без разряда";

export const rankOptions = [
  NO_RANK,
  "3-й юн.",
  "2-й юн.",
  "1-й юн.",
  "3-й разряд",
  "2-й разряд",
  "1-й разряд",
  "КМС",
  "МС",
  "МСМК",
  "ЗМС",
];

export function isSportRank(rank: string | null | undefined): boolean {
  return !!rank && rank !== NO_RANK;
}
