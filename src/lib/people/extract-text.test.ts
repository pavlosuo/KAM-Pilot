import JSZip from "jszip";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { extractPersonFileText } from "./extract-text";

const file = (name: string, bytes: Uint8Array) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer }) as File;

async function office(name: string, entry: string, xml: string) {
  const zip = new JSZip();
  zip.file(entry, xml);
  return file(name, await zip.generateAsync({ type: "uint8array" }));
}

describe("Person Office uploads", () => {
  it("reads Word meeting notes", async () => {
    const upload = await office("notes.docx", "word/document.xml", "<w:document><w:p><w:r><w:t>Anna Virtanen &amp; procurement</w:t></w:r></w:p></w:document>");
    expect(await extractPersonFileText(upload)).toBe("Anna Virtanen & procurement");
  });

  it("reads PowerPoint meeting notes as well as slide text", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", "<a:p><a:t>Anna Virtanen</a:t></a:p>");
    zip.file("ppt/notesSlides/notesSlide1.xml", "<a:p><a:t>Wants lower garment costs</a:t></a:p>");
    const text = await extractPersonFileText(file("meeting.pptx", await zip.generateAsync({ type: "uint8array" })));
    expect(text).toContain("Anna Virtanen");
    expect(text).toContain("Wants lower garment costs");
  });

  it("reads Excel CRM values with their field names", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Name", "Role", "City"], ["Anna Virtanen", "Procurement director", "Helsinki"]]), "CRM");
    const text = await extractPersonFileText(file("crm.xlsx", XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
    expect(text).toContain("Name: Anna Virtanen");
    expect(text).toContain("Role: Procurement director");
    expect(text).toContain("City: Helsinki");
  });
});