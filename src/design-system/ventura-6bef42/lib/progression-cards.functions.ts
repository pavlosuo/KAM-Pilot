import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  startupId: z.string().uuid(),
  updateId: z.string().uuid(),
  summary: z.string().min(1),
});

const cardSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(40),
  icon_name: z
    .string()
    .min(1)
    .max(60)
    .describe(
      "A valid lucide-react icon name in kebab-case (e.g. 'users', 'rocket', 'phone-call', 'handshake', 'code-2', 'trending-up').",
    ),
  description: z
    .string()
    .min(1)
    .max(400)
    .describe(
      "2-3 sentence explanation of this card grounded in the update text or existing traction. Plain prose, no markdown, written for an outside reader who clicks the card to learn more.",
    ),
});

const outputSchema = z.object({
  cards: z.array(cardSchema).max(6),
});

function fallbackProgressionCard(summary: string, traction: string | null) {
  const source = [summary, traction].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const description = source.length > 360 ? `${source.slice(0, 357).trim()}...` : source;

  return {
    label: "Latest progress",
    value: "Update",
    icon_name: "trending-up",
    description:
      description ||
      "The startup shared a new weekly update. More detail will appear as future updates are added.",
  };
}

export const generateProgressionCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: startup, error: sErr } = await supabase
      .from("startups")
      .select("id, owner_id, traction, published_at")
      .eq("id", data.startupId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!startup) throw new Error("Startup not found");

    function currentWeekStart(publishedAt: string | null): string | null {
      if (!publishedAt) return null;
      const pub = new Date(publishedAt);
      pub.setUTCHours(0, 0, 0, 0);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const days = Math.floor((today.getTime() - pub.getTime()) / 86400000);
      if (days < 0) return pub.toISOString().slice(0, 10);
      const weeks = Math.floor(days / 7);
      const start = new Date(pub.getTime() + weeks * 7 * 86400000);
      return start.toISOString().slice(0, 10);
    }
    const weekStart = currentWeekStart(
      (startup as { published_at: string | null }).published_at,
    );

    type InheritCard = {
      label: string;
      value: string | null;
      icon_name: string | null;
      image_url: string | null;
      description: string | null;
    };
    let inheritedCards: InheritCard[] = [];
    if (weekStart) {
      const { data: weekUpdates } = await supabase
        .from("weekly_updates")
        .select("id, created_at")
        .eq("startup_id", data.startupId)
        .eq("week_of", weekStart)
        .neq("id", data.updateId)
        .order("created_at", { ascending: false });
      const ids = ((weekUpdates as { id: string }[] | null) ?? []).map((r) => r.id);
      for (const id of ids) {
        const { data: existing } = await supabase
          .from("startup_progression_cards")
          .select("label, value, icon_name, image_url, description, display_order")
          .eq("weekly_update_id", id)
          .order("display_order", { ascending: true });
        const rows = (existing as InheritCard[] | null) ?? [];
        if (rows.length > 0) {
          inheritedCards = rows;
          break;
        }
      }
    }

    let cards: Array<{
      label: string;
      value: string;
      icon_name: string | null;
      image_url: string | null;
      description: string | null;
      source_type: string;
    }>;

    if (inheritedCards.length > 0) {
      cards = inheritedCards.map((c) => ({
        label: c.label,
        value: c.value ?? "",
        icon_name: c.icon_name,
        image_url: c.image_url,
        description: c.description,
        source_type: "ai_inferred",
      }));
    } else {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const { createLovableAiGatewayProvider } = await import("@/design-system/ventura-6bef42/lib/ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(key);

      const system = `You generate short "Startup Progression" cards summarizing a startup's traction.
Each card has:
- label: 1-3 word description (e.g. "Paying customers", "Cold calls", "Working product", "Pilot customers")
- value: short metric or status (e.g. "5", "100+", "MVP", "30+", "Partner")
- icon_name: a lucide-react icon name in kebab-case that fits the card meaning.
- description: 2-3 plain-prose sentences that explain the card in more detail for an outside reader (investor / community member) who clicks the card on the public startup profile. Pull facts ONLY from the provided traction info and weekly update text. Do not invent numbers, names, or claims. Keep it concrete and concise.

Pick 3 to 6 cards total. Combine the existing traction info with the latest weekly update.
Only include cards backed by the provided text. Keep labels and values very short.
Use real lucide icon names like: users, phone, phone-call, code-2, rocket, handshake, trending-up, target, briefcase, dollar-sign, star, building-2, megaphone, line-chart, package, globe, zap.`;

      const prompt = `Existing traction:\n${(startup as { traction: string | null }).traction ?? "(none)"}\n\nLatest weekly update (finalized):\n${data.summary}`;

      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system:
          system +
          '\n\nRespond ONLY with raw JSON matching: {"cards":[{"label":string,"value":string,"icon_name":string,"description":string}]}. No markdown, no code fences, no commentary.',
        prompt,
      });

      function extractJSON(raw: string): unknown {
        let cleaned = raw
          .replace(/^```json\s*/im, "")
          .replace(/^```\s*/im, "")
          .replace(/```\s*$/im, "")
          .trim();
        if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
          const s = cleaned.indexOf("{");
          const e = cleaned.lastIndexOf("}");
          if (s !== -1 && e > s) cleaned = cleaned.slice(s, e + 1);
        }
        return JSON.parse(cleaned);
      }

      const parsed = outputSchema.safeParse(extractJSON(text));
      const aiCards =
        parsed.success && parsed.data.cards.length > 0
          ? parsed.data.cards
          : [
              fallbackProgressionCard(
                data.summary,
                (startup as { traction: string | null }).traction ?? null,
              ),
            ];
      cards = aiCards.map((c) => ({
        label: c.label,
        value: c.value,
        icon_name: c.icon_name,
        image_url: null,
        description: c.description,
        source_type: "ai_inferred",
      }));
    }

    const { error: dErr } = await supabase
      .from("startup_progression_cards")
      .delete()
      .eq("weekly_update_id", data.updateId);
    if (dErr) throw dErr;

    const rows = cards.map((c, i) => ({
      startup_id: data.startupId,
      weekly_update_id: data.updateId,
      card_type: "metric",
      label: c.label,
      value: c.value,
      icon_name: c.image_url ? null : c.icon_name,
      image_url: c.image_url,
      description: c.description,
      source_type: c.source_type,
      display_order: i,
      is_public: true,
    }));

    const { data: inserted, error: iErr } = await supabase
      .from("startup_progression_cards")
      .insert(rows as never)
      .select("id, label, value, icon_name, image_url, description, display_order");
    if (iErr) throw iErr;

    void userId;
    return { cards: inserted ?? [] };
  });
