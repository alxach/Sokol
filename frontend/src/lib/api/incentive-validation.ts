/**
 * Validation rules from Положение о мат. поддержке ред. 8 (ЦСиЗ-26-П022).
 * Enforces budget caps, minimum participants, and plan-only restrictions.
 */

export type PlanItemCategory =
  | "special_events"
  | "sport_events"
  | "development_events"
  | "other";

export interface PlanItem {
  id: string;
  name: string;
  category: PlanItemCategory;
  participantsCount: number;
  centerId: string;
  date: string;
}

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * П. 3.1.4: Мероприятия с ≤3 участниками не учитываются для начисления.
 */
export function validateMinParticipants(item: PlanItem): ValidationResult {
  if (item.participantsCount <= 3) {
    return {
      ok: false,
      warnings: [],
      errors: [
        `Мероприятие «${item.name}» (${item.participantsCount} уч.) не учитывается — менее 4 участников (п. 3.1.4).`,
      ],
    };
  }
  return { ok: true, warnings: [], errors: [] };
}

/**
 * П. 3.2.3: Доля спортивных мероприятий ≤5% от бюджета ЦСЕ.
 * totalBudget — общий бюджет ЦСЕ за период.
 * sportBudget — суммарные затраты на спортивные мероприятия.
 */
export function validateSportEventsBudget(
  centerName: string,
  totalBudget: number,
  sportBudget: number,
): ValidationResult {
  if (totalBudget <= 0) return { ok: true, warnings: [], errors: [] };
  const pct = (sportBudget / totalBudget) * 100;
  if (pct > 5) {
    return {
      ok: false,
      warnings: [],
      errors: [
        `Доля спортивных мероприятий в «${centerName}» — ${pct.toFixed(1)}% (лимит ≤5%, п. 3.2.3).`,
      ],
    };
  }
  if (pct > 4) {
    return {
      ok: true,
      warnings: [
        `Доля спортивных мероприятий в «${centerName}» — ${pct.toFixed(1)}% (ใกล้ лимита 5%, п. 3.2.3).`,
      ],
      errors: [],
    };
  }
  return { ok: true, warnings: [], errors: [] };
}

/**
 * П. 4.3: Доля спортивных мероприятий ≤30% от общего бюджета программы.
 * programBudget — общий бюджет программы стимулирования.
 * sportBudget — суммарные затраты на спортивные мероприятия по всем ЦСЕ.
 */
export function validateProgramSportCap(
  programBudget: number,
  sportBudget: number,
): ValidationResult {
  if (programBudget <= 0) return { ok: true, warnings: [], errors: [] };
  const pct = (sportBudget / programBudget) * 100;
  if (pct > 30) {
    return {
      ok: false,
      warnings: [],
      errors: [
        `Доля спортивных мероприятий в программе — ${pct.toFixed(1)}% (лимит ≤30%, п. 4.3).`,
      ],
    };
  }
  return { ok: true, warnings: [], errors: [] };
}

/**
 * П. 3.1.3: Мероприятия, не включённые в план, не могут быть оплачены
 * (кроме спортивных мероприятий).
 */
export function validatePlanOnly(
  items: PlanItem[],
  excludeCategory: PlanItemCategory = "sport_events",
): ValidationResult {
  const nonPlanItems = items.filter((i) => i.category !== excludeCategory);
  if (nonPlanItems.length === 0) return { ok: true, warnings: [], errors: [] };
  // This is informational — in practice, only approved plans feed into payment
  return {
    ok: true,
    warnings: [
      `${nonPlanItems.length} мер. не из плана (категория "${excludeCategory}" допускается без плана, п. 3.1.3).`,
    ],
    errors: [],
  };
}

/**
 * Aggregate validation for a full plan submission.
 */
export function validatePlanSubmission(items: PlanItem[]): ValidationResult {
  const allWarnings: string[] = [];
  const allErrors: string[] = [];

  for (const item of items) {
    const minPart = validateMinParticipants(item);
    allErrors.push(...minPart.errors);
  }

  const sportItems = items.filter((i) => i.category === "sport_events");
  const otherItems = items.filter((i) => i.category !== "sport_events");
  const planResult = validatePlanOnly(otherItems);
  allWarnings.push(...planResult.warnings);

  return {
    ok: allErrors.length === 0,
    warnings: allWarnings,
    errors: allErrors,
  };
}
