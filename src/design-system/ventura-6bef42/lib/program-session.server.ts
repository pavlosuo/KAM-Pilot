import { useSession } from "@tanstack/react-start/server";

export type ProgramSessionData = {
  programId?: string;
  slug?: string;
};

function sessionConfig() {
  const password = process.env.PROGRAM_SESSION_SECRET;
  if (!password) throw new Error("PROGRAM_SESSION_SECRET is not set");
  return {
    password,
    name: "ventura-program",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      // The app is embedded in a cross-site iframe in the editor preview, where
      // "lax" cookies are dropped — the dashboard then looked signed out again.
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export async function getProgramSessionRaw() {
  return useSession<ProgramSessionData>(sessionConfig());
}

// Returns the program id for a slug when the caller holds a valid session for it.
export async function requireProgram(slug: string): Promise<string> {
  const session = await getProgramSessionRaw();
  const { programId, slug: sessionSlug } = session.data;
  if (!programId || sessionSlug !== slug) throw new Error("Unauthorized");
  return programId;
}
