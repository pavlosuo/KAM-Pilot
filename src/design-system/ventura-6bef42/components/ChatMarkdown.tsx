import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/design-system/ventura-6bef42/lib/utils";

function isStandaloneStrong(children: ReactNode): boolean {
  const items = Children.toArray(children).filter((c) => {
    if (!c) return false;
    if (typeof c === "string") return c.trim().length > 0;
    return true;
  });
  return (
    items.length === 1 &&
    typeof items[0] === "object" &&
    (items[0] as { type?: unknown }).type === "strong"
  );
}

export function ChatMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={cn(isStandaloneStrong(children) && "my-4")}>{children}</p>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-md border border-border">
              <table className="my-0 w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default ChatMarkdown;
