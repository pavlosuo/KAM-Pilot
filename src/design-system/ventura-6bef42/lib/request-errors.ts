type ErrorLike = {
  message?: unknown;
  code?: unknown;
  cause?: unknown;
  stack?: unknown;
};

const DISCONNECT_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ECONNABORTED",
  "ERR_STREAM_PREMATURE_CLOSE",
]);

/** A browser navigation or refresh can close the HTTP socket mid-request. */
export function isClientDisconnect(error: unknown): boolean {
  // Some streaming libraries reduce the Node socket error to its message
  // before forwarding it to an onError callback.
  if (error === "aborted") return true;

  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (typeof current !== "object") return false;

    const candidate = current as ErrorLike;
    if (typeof candidate.code === "string" && DISCONNECT_CODES.has(candidate.code)) return true;
    if (candidate.message === "aborted") {
      // Node's http server aborts in-flight requests when the browser navigates
      // away or refreshes; there is no cause on that error, only the stack.
      const stack = typeof candidate.stack === "string" ? candidate.stack : "";
      if (
        candidate.cause != null ||
        stack.includes("abortIncoming") ||
        stack.includes("_http_server") ||
        stack.includes("socketOnClose")
      ) {
        return true;
      }
    }
    current = candidate.cause;
  }

  return false;
}