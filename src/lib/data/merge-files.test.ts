import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ingestRawSheets, readWorkbookSheets, type RawSheet } from "./ingest";
import { combinedSourceName, mergeUploadedSheets, MAX_UPLOAD_FILES, type UploadedFileSheets } from "./merge-files";

const file = (name: string, sheets: RawSheet[]): UploadedFileSheets => ({ id: name, name, kind: "excel", size: 1, sheets });

describe("combining up to three uploaded files", () => {
  it("allows three files", () => expect(MAX_UPLOAD_FILES).toBe(3));

  it("stacks the same table from two files and drops identical rows", () => {
    const a = file("2024.xlsx", [{ name: "Repairs", headers: ["month", "repair_count"], rows: [["2024-12", 3], ["2025-01", 5]] }]);
    const b = file("2025.pdf", [{ name: "Repairs", headers: ["month", "repair_count"], rows: [["2025-01", 5], ["2025-02", 7]] }]);
    const { sheets, summary } = mergeUploadedSheets([a, b]);
    const repairs = sheets.find((s) => s.name === "Repairs")!;
    expect(repairs.rows).toEqual([["2024-12", 3], ["2025-01", 5], ["2025-02", 7]]);
    expect(summary.tables.find((t) => t.table === "repairs")?.files).toEqual(["2024.xlsx", "2025.pdf"]);
    expect(summary.tables.find((t) => t.table === "repairs")?.duplicatesDropped).toBe(1);
  });

  it("aligns columns by field, not by position, and keeps the first master-data id", () => {
    const a = file("a.xlsx", [{ name: "Customers", headers: ["customer_id", "customer_name", "industry"], rows: [["C1", "Alpha", "Food"]] }]);
    const b = file("b.xlsx", [{ name: "Accounts", headers: ["industry", "account_id", "account_name"], rows: [["Retail", "C1", "Alpha 2"], ["Health", "C2", "Beta"]] }]);
    const { sheets } = mergeUploadedSheets([a, b]);
    const customers = sheets.find((s) => s.name === "Customers")!;
    expect(customers.headers).toEqual(["customer_id", "customer_name", "industry"]);
    expect(customers.rows).toEqual([["C1", "Alpha", "Food"], ["C2", "Beta", "Health"]]);
  });

  it("reports sheets that match no table", () => {
    const a = file("notes.xlsx", [{ name: "Scratch", headers: ["foo", "bar"], rows: [[1, 2]] }]);
    expect(mergeUploadedSheets([a]).summary.unused).toEqual([{ file: "notes.xlsx", sheet: "Scratch" }]);
  });

  it("validates the reference workbook split across two files exactly like one file", () => {
    const sheets = readWorkbookSheets(readFileSync("tests/fixtures/lindstrom-synthetic-data-pack.xlsx"));
    const master = sheets.filter((s) => /customers|sites|products|laundries|industry/i.test(s.name));
    const rest = sheets.filter((s) => !master.includes(s));
    const merged = mergeUploadedSheets([file("master.xlsx", master), file("figures.xlsx", rest)]);
    const two = ingestRawSheets(merged.sheets, combinedSourceName([{ name: "master.xlsx" }, { name: "figures.xlsx" }]));
    const one = ingestRawSheets(sheets, "pack.xlsx");
    expect(two.dataset?.activity.length).toBe(one.dataset?.activity.length);
    expect(two.dataset?.sites.length).toBe(24 + 6 + 4);
    expect(two.report.sourceName).toBe("master.xlsx + figures.xlsx");
  });
});
