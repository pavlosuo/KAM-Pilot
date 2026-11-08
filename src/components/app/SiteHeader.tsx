import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LindstromMark } from "./LindstromMark";

/**
 * Lindström site header: thin dark utility strip and a white bar with the
 * wordmark, as on lindstromgroup.com. Pages put their own actions on the right
 * and an optional row (tabs) underneath.
 */
export function SiteHeader({ right, below, strip }: { right?: ReactNode; below?: ReactNode; strip?: ReactNode }) {
  return (
    <header className="bg-card shadow-lind">
      {strip ? (
        <div className="bg-lind-ink text-white">
          <div className="mx-auto flex h-9 w-full max-w-7xl items-center justify-between gap-3 px-4 text-xs font-bold uppercase tracking-wider sm:px-6">
            <span className="truncate">{strip}</span>
            <span className="hidden text-white/70 sm:inline">Data stays in this browser</span>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link to="/" className="shrink-0 rounded-md transition-opacity hover:opacity-80" aria-label="Lindström report studio">
          <LindstromMark />
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">{right}</div>
      </div>
      {below}
    </header>
  );
}
