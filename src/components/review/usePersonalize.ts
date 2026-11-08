import { useCallback, useState } from "react";
import { toast } from "sonner";
import { interpretPriorityNote } from "@/lib/ai/personalize.functions";
import { parsePriorityText, PRIORITY_KEYS, type Weights } from "@/lib/engine/priorities";
import { useAccount } from "@/lib/state/account-context";

/**
 * Free-text "what matters to this customer" → emphasis weights.
 * Rules apply instantly (transparent keyword reading); the AI reading refines
 * it a moment later. Both are kept so the KAM can see why the view changed.
 */
export function usePersonalize() {
  const { update, customer, customerSites } = useAccount();
  const [pending, setPending] = useState(false);

  const apply = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (t.length < 2) return;
      const rules = parsePriorityText(t);
      const hasRules = Object.values(rules.weights).some((v) => v > 0);
      update({ prompt: { text: t, weights: rules.weights, source: "rules" } });
      if (hasRules) toast.success("Emphasis updated from your note");
      setPending(true);
      try {
        const res = await interpretPriorityNote({
          data: { text: t, customerName: customer.name, industry: customer.industry, siteNames: customerSites.map((s) => s.name) },
        });
        if (res.ok) {
          const weights = Object.fromEntries(PRIORITY_KEYS.map((k) => [k, Number(res.weights[k] ?? 0)])) as Weights;
          if (Object.values(weights).some((v) => v > 0)) {
            update({ prompt: { text: t, weights, source: "ai", rationale: res.rationale, focusSites: res.focusSites } });
            toast.success("AI refined the emphasis", { description: res.rationale });
          } else if (!hasRules) {
            update({ prompt: null });
            toast.info("No priorities recognised in that note - the view is unchanged.");
          }
        } else if (!hasRules) {
          update({ prompt: null });
          toast.error(res.error);
        } else {
          toast.info(res.error);
        }
      } catch {
        if (!hasRules) update({ prompt: null });
        toast.info("The AI reading is unavailable; the keyword reading is used.");
      } finally {
        setPending(false);
      }
    },
    [update, customer.name, customer.industry, customerSites],
  );

  const clear = useCallback(() => update({ prompt: null }), [update]);
  return { apply, clear, pending };
}
