import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_public_startups",
  title: "List public startups",
  description:
    "List startups that are publicly visible on Ventura, with their name, one-liner, industry tags and public slug.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of startups to return (1-50, default 20)."),
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .describe("Optional case-insensitive search over startup name and one-liner."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      return {
        content: [{ type: "text", text: "Supabase is not configured." }],
        isError: true,
      };
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = supabase
      .from("startups")
      .select("name, one_liner, industry_tags, slug, website")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (search) {
      const escaped = search.replace(/[%,]/g, " ");
      query = query.or(`name.ilike.%${escaped}%,one_liner.ilike.%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
      return {
        content: [{ type: "text", text: `Query failed: ${error.message}` }],
        isError: true,
      };
    }

    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { startups: rows },
    };
  },
});
