import type PptxGenJS from "pptxgenjs";
import type { Deck } from "./deck";
import type { HexPalette } from "./colors";
import { normalizePptxArchive } from "./pptx-archive";
import { layoutDeck, measurable, type Op } from "./slide-layout";

export { fittedTextSize } from "./slide-layout";

const FONT = "Arial";
const hex = (c: string) => c.replace("#", "").toUpperCase();

/** Renders the Recap deck to an editable .pptx (16:9, native shapes and text). */
export async function deckToPptx(deck: Deck, pal: HexPalette): Promise<Blob> {
  // JSZip's legacy postMessage scheduler can stall in embedded previews.
  // Install a native microtask scheduler before loading its browser bundle.
  if (typeof globalThis.setImmediate !== "function") {
    Reflect.defineProperty(globalThis, "setImmediate", {
      configurable: true,
      writable: true,
      value: (callback: (...args: unknown[]) => void, ...args: unknown[]) => queueMicrotask(() => callback(...args)),
    });
  }
  const { default: Pptx } = await import("pptxgenjs");
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  // Text is sized before writing (PowerPoint's shrink flag only applies after editing):
  // Helvetica metrics match Arial closely enough for the fitting safety margins.
  const measurement = await PDFDocument.create();
  const regular = await measurement.embedFont(StandardFonts.Helvetica);
  const bold = await measurement.embedFont(StandardFonts.HelveticaBold);
  const measure = (text: string, size: number, b: boolean) => (b ? bold : regular).widthOfTextAtSize(measurable(text), size);

  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${deck.customer} - Recap`;
  pptx.company = "Lindström";
  pptx.subject = "Customer value review";

  for (const slide of layoutDeck(deck, pal, measure)) {
    const s = pptx.addSlide();
    s.background = { color: hex(slide.bg) };
    for (const op of slide.ops) paint(pptx, s, op);
  }

  const bytes = await pptx.write({ outputType: "uint8array" });
  const out = await normalizePptxArchive(bytes as Uint8Array);
  return new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

const NO_LINE = { type: "none" as const };

function paint(pptx: PptxGenJS, s: PptxGenJS.Slide, op: Op) {
  switch (op.op) {
    case "rect": {
      const line = op.line ? { color: hex(op.line), width: op.lineW ?? 0.75 } : NO_LINE;
      const fill = op.fill ? { color: hex(op.fill) } : undefined;
      if (op.radius && op.radius > 0.005) s.addShape(pptx.ShapeType.roundRect, { x: op.x, y: op.y, w: op.w, h: op.h, fill, line, rectRadius: op.radius });
      else s.addShape(pptx.ShapeType.rect, { x: op.x, y: op.y, w: op.w, h: op.h, fill, line });
      return;
    }
    case "ellipse": {
      const line = op.line ? { color: hex(op.line), width: op.lineW ?? 0.75, ...(op.dash ? { dashType: "dash" as const } : {}) } : NO_LINE;
      s.addShape(pptx.ShapeType.ellipse, { x: op.x, y: op.y, w: op.w, h: op.h, fill: op.fill ? { color: hex(op.fill) } : undefined, line });
      return;
    }
    case "tri":
      s.addShape(pptx.ShapeType.triangle, { x: op.x, y: op.y, w: op.w, h: op.h, fill: { color: hex(op.fill) }, line: NO_LINE });
      return;
    case "arc": {
      // OOXML block arcs measure angles clockwise from 3 o'clock; ours start at 12 o'clock.
      const a0 = (270 + op.from) % 360;
      const a1 = (270 + op.to) % 360;
      s.addShape(pptx.ShapeType.blockArc, {
        x: op.cx - op.r,
        y: op.cy - op.r,
        w: op.r * 2,
        h: op.r * 2,
        fill: { color: hex(op.fill) },
        line: NO_LINE,
        angleRange: [a0, a1],
        arcThicknessRatio: Math.min(1, op.thick / op.r),
      });
      return;
    }
    case "text":
      s.addText(op.text, {
        x: op.x,
        y: op.y,
        w: op.w,
        h: op.h,
        fontFace: FONT,
        fontSize: op.size,
        bold: !!op.bold,
        italic: !!op.italic,
        color: hex(op.color),
        align: op.align ?? "left",
        valign: op.valign ?? "top",
        margin: 0,
        charSpacing: op.spacing,
        breakLine: false,
        paraSpaceAfter: 0,
        paraSpaceBefore: 0,
      });
      return;
  }
}
