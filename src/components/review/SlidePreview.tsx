import { useEffect, useMemo, useState } from "react";
import type { Deck } from "@/lib/export/deck";
import { exportPalette, type HexPalette } from "@/lib/export/colors";
import { arcPath, layoutDeck, LINE_HEIGHT, SLIDE_H, SLIDE_W, type Measure, type Op, type SlideOps } from "@/lib/export/slide-layout";

/** 1 inch = 100 SVG units; text sizes are points. */
const U = 100;
const pt = (size: number) => (size * U) / 72;

function canvasMeasure(): Measure {
  const ctx = document.createElement("canvas").getContext("2d");
  const family = getComputedStyle(document.body).fontFamily;
  return (text, size, bold) => {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
    return ctx.measureText(text).width;
  };
}

/** Lays the deck out for the screen with the same rules as the PowerPoint and PDF (after hydration). */
export function useDeckLayout(deck: Deck): SlideOps[] | null {
  const [env, setEnv] = useState<{ pal: HexPalette; measure: Measure } | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => alive && setEnv({ pal: exportPalette(), measure: canvasMeasure() });
    void document.fonts?.ready.then(read);
    read();
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => (env ? layoutDeck(deck, env.pal, env.measure) : null), [deck, env]);
}

function OpView({ op }: { op: Op }) {
  switch (op.op) {
    case "rect":
      return (
        <rect
          x={op.x * U}
          y={op.y * U}
          width={op.w * U}
          height={op.h * U}
          rx={op.radius ? op.radius * U : 0}
          fill={op.fill ?? "none"}
          stroke={op.line ?? "none"}
          strokeWidth={op.line ? pt(op.lineW ?? 0.75) : 0}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={(op.x + op.w / 2) * U}
          cy={(op.y + op.h / 2) * U}
          rx={(op.w / 2) * U}
          ry={(op.h / 2) * U}
          fill={op.fill ?? "none"}
          stroke={op.line ?? "none"}
          strokeWidth={op.line ? pt(op.lineW ?? 0.75) : 0}
          strokeDasharray={op.dash ? `${pt(4)} ${pt(4)}` : undefined}
        />
      );
    case "tri":
      return <polygon points={`${(op.x + op.w / 2) * U},${op.y * U} ${(op.x + op.w) * U},${(op.y + op.h) * U} ${op.x * U},${(op.y + op.h) * U}`} fill={op.fill} />;
    case "arc":
      return <path d={arcPath(op.cx * U, op.cy * U, op.r * U, op.thick * U, op.from, op.to)} fill={op.fill} />;
    case "text":
      return (
        <foreignObject x={op.x * U} y={op.y * U} width={op.w * U} height={op.h * U}>
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: op.valign === "middle" ? "center" : "flex-start",
              justifyContent: op.align === "center" ? "center" : op.align === "right" ? "flex-end" : "flex-start",
              textAlign: op.align ?? "left",
              fontSize: pt(op.size),
              lineHeight: LINE_HEIGHT,
              letterSpacing: op.spacing ? pt(op.spacing) : undefined,
              fontWeight: op.bold ? 700 : 400,
              fontStyle: op.italic ? "italic" : undefined,
              color: op.color,
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
            }}
          >
            <span>{op.text}</span>
          </div>
        </foreignObject>
      );
  }
}

/** On-screen rendering of one laid-out slide (same operations as the PowerPoint and PDF). */
export function SlidePreview({ slide, index }: { slide: SlideOps; index: number }) {
  return (
    <svg viewBox={`0 0 ${SLIDE_W * U} ${SLIDE_H * U}`} role="img" aria-label={`Slide ${index + 1}`} className="block h-auto w-full overflow-hidden rounded-lg shadow-lind">
      <rect x={0} y={0} width={SLIDE_W * U} height={SLIDE_H * U} fill={slide.bg} />
      {slide.ops.map((op, i) => (
        <OpView key={i} op={op} />
      ))}
    </svg>
  );
}
