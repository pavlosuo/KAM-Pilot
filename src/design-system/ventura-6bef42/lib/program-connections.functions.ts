import { chargeCohortMatch } from "@/design-system/ventura-6bef42/lib/ai-credits-program.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addConnectionSchema,
  addProgramConnection,
  deleteProgramConnection,
  matchCohortConnections,
  matchCohortSchema,
  resolveConnectionRequest,
} from "@/design-system/ventura-6bef42/lib/program-connections.server";

export const addConnection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => addConnectionSchema.parse(d))
  .handler(async ({ data }) => addProgramConnection(data));

export const removeConnection = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => deleteProgramConnection(data.slug, data.id));

export const matchConnectionsWithCohort = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => matchCohortSchema.parse(d))
  .handler(async ({ data }) => {
    await chargeCohortMatch((data as { slug: string }).slug);
    return matchCohortConnections(data);
  });

export const resolveIntroRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => resolveConnectionRequest(data.slug, data.id));
