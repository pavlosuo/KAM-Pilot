import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { writeSummary } from "./summary.server";

const input = z.object({ context: z.string().min(2).max(60_000) });

export const writeExecutiveSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => writeSummary(data.context));
