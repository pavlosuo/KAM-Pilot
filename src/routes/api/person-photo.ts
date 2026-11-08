import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { lookupPortrait } from "@/lib/people/research.server";

const input = z.object({
  name: z.string().trim().min(2).max(80),
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().max(80),
  linkedin: z.string().trim().max(400).nullable(),
});

export const Route = createFileRoute("/api/person-photo")({
  server: { handlers: { POST: async ({ request }) => {
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Add the person's name first." }, { status: 400 });
    const { name, company, role, linkedin } = parsed.data;
    const portrait = await lookupPortrait(name, company, role, linkedin, null, new Set(), request.signal);
    return Response.json({ photo: portrait?.photo ?? null, photoSource: portrait?.source ?? null }, { headers: { "Cache-Control": "no-store" } });
  } } },
});