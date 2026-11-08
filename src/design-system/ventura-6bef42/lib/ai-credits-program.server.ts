import { chargeAiCredits } from "@/design-system/ventura-6bef42/lib/ai-credits.server";

/** Charges the lead pool for a cohort-wide mentor/investor match refresh. */
export async function chargeCohortMatch(slug: string) {
  const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
  const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
  const programId = await requireProgram(slug);
  await chargeAiCredits(supabaseAdmin, { programId, action: "lead_cohort_match" });
}
