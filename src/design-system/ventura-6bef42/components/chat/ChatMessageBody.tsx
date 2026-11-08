import { Fragment, useMemo } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Renders a chat message body: quoted reply lines ("> …") as a quote block,
 * and @handle mentions as links to the public profile.
 */
export function ChatMessageBody({ body }: { body: string }) {
  const { quote, rest } = useMemo(() => {
    const lines = body.split("\n");
    const quoteLines: string[] = [];
    let i = 0;
    while (i < lines.length && lines[i].startsWith(">")) {
      quoteLines.push(lines[i].replace(/^>\s?/, ""));
      i += 1;
    }
    return { quote: quoteLines.join("\n"), rest: lines.slice(i).join("\n") };
  }, [body]);

  return (
    <>
      {quote ? (
        <span className="mb-1 block border-l-2 border-current/40 pl-2 text-xs opacity-70">
          {quote}
        </span>
      ) : null}
      <MentionText text={rest} />
    </>
  );
}

function MentionText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: Array<{ type: "text" | "mention"; value: string }> = [];
    const re = /@([a-zA-Z0-9_-]{2,40})/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
      out.push({ type: "mention", value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", value: text.slice(last) });
    return out;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <Link
            key={i}
            to="/u/$handle"
            params={{ handle: p.value }}
            className="font-medium underline-offset-2 hover:underline"
          >
            @{p.value}
          </Link>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        ),
      )}
    </>
  );
}

/** Strips leading quoted reply lines ("> …") for compact previews. */
export function stripQuotedReply(body: string): string {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].startsWith(">")) i += 1;
  const rest = lines.slice(i).join("\n").trim();
  return rest || lines.map((l) => l.replace(/^>\s?/, "")).join(" ").trim();
}
