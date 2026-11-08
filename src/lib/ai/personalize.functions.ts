import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { interpretPriorities } from "./personalize.server";

const input = z.object({
  text: z.string().min(2).max(1500),
  customerName: z.string().max(200),
  industry: z.string().max(100),
  siteNames: z.array(z.string().max(120)).max(200),
});

/** AI reading of a free-text priority note → emphasis weights (rules-based reading is shown alongside). */
export const interpretPriorityNote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => interpretPriorities(data));
