import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/design-system/ventura-6bef42/integrations/supabase/auth-middleware";

const MAX_DURATION_SECONDS = 120;

async function assertStartupAccess(
  supabase: { from: (t: string) => unknown },
  startupId: string,
  userId: string,
) {
  const ownerQ = supabase.from("startups") as unknown as {
    select: (s: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    };
  };
  const { data: own } = await ownerQ
    .select("id")
    .eq("id", startupId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (own) return;
  const memberQ = supabase.from("startup_members") as unknown as {
    select: (s: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null }>;
        };
      };
    };
  };
  const { data: mem } = await memberQ
    .select("id")
    .eq("startup_id", startupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!mem) throw new Error("Startup not found or you don't have access");
}

export const createPitchVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        fileSize: z.number().int().positive().max(600 * 1024 * 1024),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStartupAccess(supabase, data.startupId, userId);

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
    if (!accountId || !token) throw new Error("Cloudflare Stream is not configured");

    // Use tus resumable uploads — reliable on mobile / flaky networks.
    // Cloudflare returns a Location URL the browser then PATCHes chunks to.
    const b64 = (s: string) =>
      typeof btoa === "function" ? btoa(s) : Buffer.from(s, "utf-8").toString("base64");
    const metadata = [
      `maxDurationSeconds ${b64(String(MAX_DURATION_SECONDS))}`,
      `expiry ${b64(new Date(Date.now() + 60 * 60 * 1000).toISOString())}`,
      `startupId ${b64(data.startupId)}`,
      `userId ${b64(userId)}`,
    ].join(",");

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(data.fileSize),
          "Upload-Metadata": metadata,
        },
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Cloudflare Stream tus create error", res.status, text);
      throw new Error("Failed to create Cloudflare upload URL");
    }
    const uploadURL = res.headers.get("location");
    const uid = res.headers.get("stream-media-id");
    if (!uploadURL || !uid) throw new Error("Cloudflare did not return an upload URL");
    return { uploadURL, uid };
  });


export const setPitchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        startupId: z.string().uuid(),
        uid: z.string().min(1).max(120),
        duration: z.number().int().positive().max(MAX_DURATION_SECONDS).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStartupAccess(supabase, data.startupId, userId);
    const { error } = await supabase
      .from("startups")
      .update({
        pitch_video_uid: data.uid,
        pitch_video_status: "processing",
        pitch_video_duration: data.duration ?? null,
      } as never)
      .eq("id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

export const deletePitchVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStartupAccess(supabase, data.startupId, userId);

    const { data: row } = await (supabase.from("startups") as unknown as {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{ data: { pitch_video_uid: string | null } | null }>;
        };
      };
    })
      .select("pitch_video_uid")
      .eq("id", data.startupId)
      .maybeSingle();

    const uid = row?.pitch_video_uid ?? null;
    if (uid) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
      if (accountId && token) {
        try {
          await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
          );
        } catch (e) {
          console.error("Cloudflare delete failed", e);
        }
      }
    }
    const { error } = await supabase
      .from("startups")
      .update({
        pitch_video_uid: null,
        pitch_video_status: null,
        pitch_video_duration: null,
      } as never)
      .eq("id", data.startupId);
    if (error) throw error;
    return { ok: true };
  });

export const getStreamCustomerCode = createServerFn({ method: "GET" }).handler(async () => {
  return { customerCode: process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? null };
});

export const getPitchVideoStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ uid: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
    if (!accountId || !token) throw new Error("Cloudflare Stream is not configured");
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${data.uid}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = (await res.json()) as {
      success?: boolean;
      result?: { readyToStream?: boolean; status?: { state?: string; errorReasonText?: string } };
    };
    if (!res.ok || !json.success || !json.result) {
      return { ready: false, state: "unknown" as const, error: null as string | null };
    }
    return {
      ready: !!json.result.readyToStream,
      state: json.result.status?.state ?? "unknown",
      error: json.result.status?.errorReasonText ?? null,
    };
  });

