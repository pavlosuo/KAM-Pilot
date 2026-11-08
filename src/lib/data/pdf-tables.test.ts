import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ingestRawSheets, ingestWorkbook } from "./ingest";
import { pagesToSheets, type PdfPage, type PdfTextItem } from "./pdf-tables";

const item = (str: string, x: number, y: number, w = str.length * 4): PdfTextItem => ({ str, x, y, w, h: 7 });

describe("PDF table reader", () => {
  it("rebuilds a titled table and assigns values to the column they sit under", () => {
    const page: PdfPage = {
      items: [
        item("Customers", 20, 560, 50),
        item("customer_id", 20, 540),
        item("customer_name", 100, 540),
        item("industry", 220, 540),
        item("CUST009", 20, 530),
        item("Nordic", 100, 530, 24),
        item("Bakeries", 126, 530, 32),
        item("Food & Beverage", 220, 530),
        item("Page 1", 400, 20),
      ],
    };
    const { sheets, stats } = pagesToSheets([page]);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("Customers");
    expect(sheets[0].rows).toEqual([["CUST009", "Nordic Bakeries", "Food & Beverage"]]);
    expect(stats.skippedLines).toBe(1);
  });

  it("continues a table across pages when the header repeats", () => {
    const header = (y: number) => [item("laundry_id", 20, y), item("laundry_name", 120, y)];
    const pages: PdfPage[] = [
      { items: [item("Laundries", 20, 570, 50), ...header(550), item("L001", 20, 540), item("Helsinki", 120, 540)] },
      { items: [...header(550), item("L002", 20, 540), item("Turku", 120, 540)] },
    ];
    const { sheets } = pagesToSheets(pages);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows.map((r) => r[0])).toEqual(["L001", "L002"]);
  });

  it("reads the bundled sample PDF to the same totals as the Excel workbook", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync("tests/fixtures/lindstrom-raw-data-sample.pdf"));
    const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, disableFontFace: true }).promise;
    const pages: PdfPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      pages.push({
        items: tc.items
          .filter((it): it is Extract<typeof it, { str: string }> => "str" in it && !!it.str)
          .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || 6 })),
      });
    }
    const { sheets } = pagesToSheets(pages);
    const fromPdf = ingestRawSheets(sheets, "sample.pdf");
    expect(fromPdf.dataset).not.toBeNull();
    expect(fromPdf.report.issues.filter((i) => i.severity === "error")).toEqual([]);

    const xlsx = readFileSync("tests/fixtures/lindstrom-synthetic-data-pack.xlsx");
    const fromXlsx = ingestWorkbook(new Uint8Array(xlsx), "pack.xlsx");
    const a = fromPdf.dataset!;
    const b = fromXlsx.dataset!;
    expect(a.sites).toHaveLength(b.sites.length);
    expect(a.activity).toHaveLength(b.activity.length);
    expect(a.repairs).toHaveLength(b.repairs.length);
    const washed = (rows: typeof a.activity) => Math.round(rows.reduce((t, r) => t + r.washedKg, 0) * 10) / 10;
    expect(washed(a.activity)).toBe(washed(b.activity));
    const co2 = (rows: typeof a.impacts) => Math.round(rows.reduce((t, r) => t + r.co2SavingLocalKg, 0));
    expect(co2(a.impacts)).toBe(co2(b.impacts));
  }, 60_000);
});
