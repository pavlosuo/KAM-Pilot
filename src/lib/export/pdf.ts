import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import type { Deck } from "./deck";
import type { HexPalette } from "./colors";
import { arcPath, layoutDeck, NOT_WIN_ANSI, LINE_HEIGHT, SLIDE_H, SLIDE_W, wrapLines, type Op } from "./slide-layout";

const PT = 72;

/** Standard PDF fonts are WinAnsi-only; map the few symbols we use. */
export function toWinAnsi(s: string): string {
  return s
    .replace(/₂/g, "2")
    .replace(/³/g, "3")
    .replace(/[≈∼]/g, "~")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/→/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/×/g, "x")
    .replace(/±/g, "+/-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(NOT_WIN_ANSI, "");
}

/** Renders the Recap deck to a 16:9 PDF with the same layout as the PowerPoint. */
export async function deckToPdf(deck: Deck, pal: HexPalette): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`${deck.customer} - Recap`);
  doc.setSubject("Customer value review");
  doc.setProducer("Lindström customer value review");
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const measure = (text: string, size: number, b: boolean) => (b ? fonts.bold : fonts.regular).widthOfTextAtSize(toWinAnsi(text), size);
  const col = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

  for (const slide of layoutDeck(deck, pal, measure)) {
    const page = doc.addPage([SLIDE_W * PT, SLIDE_H * PT]);
    page.drawRectangle({ x: 0, y: 0, width: SLIDE_W * PT, height: SLIDE_H * PT, color: col(slide.bg) });
    for (const op of slide.ops) paint(page, op, col, fonts, measure);
  }
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

/** Rounded rectangle as an SVG path in points (y down from the page top). */
function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  return `M ${x + k} ${y} H ${x + w - k} A ${k} ${k} 0 0 1 ${x + w} ${y + k} V ${y + h - k} A ${k} ${k} 0 0 1 ${x + w - k} ${y + h} H ${x + k} A ${k} ${k} 0 0 1 ${x} ${y + h - k} V ${y + k} A ${k} ${k} 0 0 1 ${x + k} ${y} Z`;
}

function paint(page: PDFPage, op: Op, col: (h: string) => RGB, fonts: Fonts, measure: (t: string, s: number, b: boolean) => number) {
  const top = SLIDE_H * PT;
  switch (op.op) {
    case "rect": {
      const border = op.line ? { borderColor: col(op.line), borderWidth: op.lineW ?? 0.75 } : {};
      if (op.radius && op.radius > 0.005) {
        page.drawSvgPath(roundRectPath(op.x * PT, op.y * PT, op.w * PT, op.h * PT, op.radius * PT), { x: 0, y: top, color: op.fill ? col(op.fill) : undefined, ...border });
      } else {
        page.drawRectangle({ x: op.x * PT, y: top - (op.y + op.h) * PT, width: op.w * PT, height: op.h * PT, color: op.fill ? col(op.fill) : undefined, ...border });
      }
      return;
    }
    case "ellipse":
      page.drawEllipse({
        x: (op.x + op.w / 2) * PT,
        y: top - (op.y + op.h / 2) * PT,
        xScale: (op.w / 2) * PT,
        yScale: (op.h / 2) * PT,
        color: op.fill ? col(op.fill) : undefined,
        borderColor: op.line ? col(op.line) : undefined,
        borderWidth: op.line ? (op.lineW ?? 0.75) : 0,
        borderDashArray: op.dash ? [4, 4] : undefined,
      });
      return;
    case "tri": {
      const [x, y, w, h] = [op.x * PT, op.y * PT, op.w * PT, op.h * PT];
      page.drawSvgPath(`M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`, { x: 0, y: top, color: col(op.fill) });
      return;
    }
    case "arc":
      page.drawSvgPath(arcPath(op.cx * PT, op.cy * PT, op.r * PT, op.thick * PT, op.from, op.to), { x: 0, y: top, color: col(op.fill) });
      return;
    case "text": {
      const font = op.bold ? fonts.bold : op.italic ? fonts.italic : fonts.regular;
      const lines = wrapLines(toWinAnsi(op.text), op.w, op.size, !!op.bold, measure);
      const lh = op.size * LINE_HEIGHT;
      const used = lines.length * lh;
      const y0 = op.y * PT + (op.valign === "middle" ? Math.max(0, (op.h * PT - used) / 2) : 0);
      lines.forEach((ln, i) => {
        const width = font.widthOfTextAtSize(ln, op.size);
        const x = op.x * PT + (op.align === "center" ? (op.w * PT - width) / 2 : op.align === "right" ? op.w * PT - width : 0);
        const baseline = y0 + i * lh + lh / 2 + op.size * 0.35;
        page.drawText(ln, { x, y: top - baseline, size: op.size, font, color: col(op.color) });
      });
      return;
    }
  }
}
