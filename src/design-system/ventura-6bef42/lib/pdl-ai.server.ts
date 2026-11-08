/**
 * Thin wrapper around the People Data Labs API.
 * `pdlFetch(url)` accepts a full PDL endpoint URL (as built by callers) and
 * performs the request with the PDL_API_KEY secret attached.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function pdlFetch(url: string): Promise<Response> {
  const apiKey = process.env.PDL_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, {
      status: 500,
      error: { message: "PDL_API_KEY is not configured" },
    });
  }
  try {
    return await fetch(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return jsonResponse(500, {
      status: 500,
      error: { message: err instanceof Error ? err.message : "PDL request failed" },
    });
  }
}
