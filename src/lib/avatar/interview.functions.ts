import { createServerFn } from "@tanstack/react-start";
import { interviewInputSchema } from "./interview-types";
import { interviewTurn } from "./interview.server";

/** One AI interview turn: reply, quick replies and the sanitized avatar draft. */
export const runInterviewTurn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => interviewInputSchema.parse(d))
  .handler(async ({ data }) => interviewTurn(data));
