import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const pdfReportSchema = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(300).nullable().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().max(160),
        paragraphs: z.array(z.string().trim().max(4000)).default([]),
        bullets: z.array(z.string().trim().max(1000)).default([]),
      }),
    )
    .min(1)
    .max(40),
});

export type PdfReportSpec = z.infer<typeof pdfReportSchema>;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** pdf-lib standard fonts only support WinAnsi — strip anything else. */
function ascii(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "");
}

/** Renders an AI-authored report spec into a downloadable PDF. */
export const renderProgramAiPdf = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ slug: z.string().min(1), report: pdfReportSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireProgram } = await import("@/design-system/ventura-6bef42/lib/program-session.server");
    const { supabaseAdmin } = await import("@/design-system/ventura-6bef42/integrations/supabase/client.server");
    const programId = await requireProgram(data.slug);
    const { data: program } = await supabaseAdmin
      .from("programs")
      .select("name")
      .eq("id", programId)
      .maybeSingle();

    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const margin = 50;
    let page = pdf.addPage([595.28, 841.89]);
    let y = page.getHeight() - margin;
    const width = page.getWidth() - margin * 2;

    const wrap = (text: string, size: number, f = font, indent = 0) => {
      const out: string[] = [];
      for (const raw of text.split("\n")) {
        const words = raw.split(/\s+/).filter(Boolean);
        let line = "";
        for (const w of words) {
          const next = line ? `${line} ${w}` : w;
          if (f.widthOfTextAtSize(next, size) > width - indent) {
            if (line) out.push(line);
            line = w;
          } else {
            line = next;
          }
        }
        out.push(line);
      }
      return out;
    };

    const write = (text: string, size = 10, f = font, gap = 4, indent = 0) => {
      for (const line of wrap(ascii(text), size, f, indent)) {
        if (y < margin + size + 10) {
          page = pdf.addPage([595.28, 841.89]);
          y = page.getHeight() - margin;
        }
        page.drawText(line, {
          x: margin + indent,
          y,
          size,
          font: f,
          color: rgb(0.1, 0.1, 0.12),
        });
        y -= size + 3;
      }
      y -= gap;
    };

    write(data.report.title, 20, bold, 4);
    if (data.report.subtitle) write(data.report.subtitle, 11, font, 4);
    write(
      `${(program as { name?: string } | null)?.name ?? "Program"} · ${new Date().toLocaleDateString()}`,
      9,
      font,
      14,
    );

    for (const section of data.report.sections) {
      if (section.heading) write(section.heading, 13, bold, 4);
      for (const p of section.paragraphs) if (p) write(p, 10, font, 6);
      for (const b of section.bullets) if (b) write(`- ${b}`, 10, font, 2, 10);
      y -= 8;
    }

    const bytes = await pdf.save();
    const safe = data.report.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().slice(0, 60);
    return {
      fileName: `${safe || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`,
      mimeType: "application/pdf",
      base64: b64(new Uint8Array(bytes)),
    };
  });
