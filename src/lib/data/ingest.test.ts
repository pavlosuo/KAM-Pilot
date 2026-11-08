import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { decodeDataset } from "./codec";
import { ingestWorkbook, toMonth, toNumber } from "./ingest";

const base = decodeDataset(JSON.parse(readFileSync("src/data/default-dataset.json", "utf8")));
function workbook(name: string, rows: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
describe("import safeguards", () => {
  it("rejects a customer-only upload without borrowing required tables", () => {
    const result = ingestWorkbook(workbook("Customers", [["customer_id", "customer_name", "industry"], ["REAL01", "Uploaded company", "Food"]]), "customer.xlsx");
    expect(result.dataset).toBeNull();
    expect(result.report.issues.some(i => i.code === "missing_table")).toBe(true);
    expect(result.report.issues.some(i => i.code === "kept_from_current")).toBe(false);
  });
  it("reads European decimal and thousands separators", () => expect(toNumber("1.234,5")).toBe(1234.5));
  it("reads English decimal and thousands separators", () => expect(toNumber("1,234.5")).toBe(1234.5));
  it("rejects month 13", () => expect(toMonth("2025-13")).toBeNull());
  it("rejects month zero", () => expect(toMonth("00.2025")).toBeNull());
  it("rejects partial master replacement instead of mixing old activity", () => {
    const result = ingestWorkbook(workbook("Customers", [["customer_id", "customer_name", "industry"], ["NEW", "New account", "Food"]]), "replacement.xlsx", { base });
    expect(result.dataset).toBeNull();
    expect(result.report.issues.some(i => i.code === "incompatible_partial_refresh")).toBe(true);
  });
});