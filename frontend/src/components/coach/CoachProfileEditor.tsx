import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { CoachDto, CoachUpdatePayload } from "@/lib/api/coaches.functions";

interface CoachProfileEditorProps {
  coach: CoachDto;
  onSave: (payload: CoachUpdatePayload) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function CoachProfileEditor({ coach, onSave, onCancel, saving }: CoachProfileEditorProps) {
  const [specialization, setSpecialization] = useState(coach.specialization);
  const [biography, setBiography] = useState(coach.biography ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!specialization.trim()) {
      setError("Укажите специализацию.");
      return;
    }
    setError(null);
    try {
      await onSave({
        specialization: specialization.trim(),
        biography: biography.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-1">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Специализация *</label>
          <Input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="Дзюдо"
            className="h-9"
            disabled={saving}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Биография</label>
        <Textarea
          value={biography}
          onChange={(e) => setBiography(e.target.value)}
          rows={3}
          placeholder="Краткая информация о тренере"
          disabled={saving}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 resize-y"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Отменить
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !specialization.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Сохранить
        </Button>
      </div>
    </div>
  );
}