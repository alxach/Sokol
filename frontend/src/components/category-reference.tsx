import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { planCategories, type PlanCategoryId } from "@/lib/mock-data";

interface CategoryReferenceProps {
  categoryId: PlanCategoryId;
}

export function CategoryReference({ categoryId }: CategoryReferenceProps) {
  const [open, setOpen] = useState(false);
  const cat = planCategories[categoryId];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/60 bg-muted/30">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-left">Требования к мероприятиям раздела {categoryId}</span>
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border/40 px-3 pb-3 pt-2">
        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Требование</p>
          <p className="text-xs text-muted-foreground">{cat.requirementSummary}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Допустимые места проведения</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
            {cat.allowedLocations.map((loc, i) => (
              <li key={i}>{loc}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Виды мероприятий</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
            {cat.eventTypes.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Категории участников</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
            {cat.participantCategories.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>

        {cat.limitations.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Ограничения</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
              {cat.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
