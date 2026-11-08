import { chargeCohortMatch } from "@/design-system/ventura-6bef42/lib/ai-credits-program.server";
import { createServerFn } from "@tanstack/react-start";
import {
  matchMentorInputSchema,
  performMentorMatch,
  persistMentorMatch,
  saveMentorInputSchema,
  type CohortMentorMatch,
  type MentorProfile,
} from "@/design-system/ventura-6bef42/lib/program-mentor-match.server";

export type { CohortMentorMatch, MentorProfile };

export const matchMentorToCohort = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => matchMentorInputSchema.parse(data))
  .handler(async ({ data }): Promise<CohortMentorMatch> => {
    await chargeCohortMatch((data as { slug: string }).slug);
    return performMentorMatch(data);
  });

export const saveMentorMatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveMentorInputSchema.parse(data))
  .handler(async ({ data }) => persistMentorMatch(data));
