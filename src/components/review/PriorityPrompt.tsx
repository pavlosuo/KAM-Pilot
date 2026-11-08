import { ArrowRight, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/design-system/ventura-6bef42/components/ui/input";

export interface PromptSuggestion {
  id: string;
  label: string;
}

/**
 * Plain, readable "what matters most" box: a labelled text field with an
 * Apply button, plus suggested questions that open the value assistant.
 */
export function PriorityPrompt({
  onSubmit,
  suggestions,
  onAsk,
  disabled,
}: {
  onSubmit: (text: string) => void;
  suggestions: PromptSuggestion[];
  onAsk: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
    setValue("");
  };
  return (
    <div className="rounded-lg bg-card p-5 shadow-lind">
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="priority-prompt" className="block text-lg font-bold text-lind-navy">
          What matters most to this customer?
        </label>
        <div className="flex flex-wrap gap-3">
          <Input
            id="priority-prompt"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. The CFO joins - focus on cost and unused garments"
            className="h-12 min-w-0 flex-1 basis-72 rounded-md border-2 border-lind-line bg-card px-4 text-base"
            disabled={disabled}
          />
          <Button type="submit" size="lg" disabled={disabled || !value.trim()}>
            Reorder the dashboard <ArrowRight />
          </Button>
        </div>
      </form>
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-lind-grey">Ask the assistant:</span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onAsk(s.label)}
              className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-lind-line bg-card px-3 py-1.5 text-left text-sm font-semibold text-lind-blue transition-colors hover:border-lind-blue"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
