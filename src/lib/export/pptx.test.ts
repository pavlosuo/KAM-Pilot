import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { fittedTextSize } from "./pptx";
import { fixParagraphProperties, normalizePptxArchive } from "./pptx-archive";

describe("PowerPoint export regressions", () => {
  it("sizes long text before writing rather than relying on PowerPoint autofit", () => {
    const measure = (value: string, size: number) => value.length * size * 0.55;
    const size = fittedTextSize("Purchased-service emissions evidence and reporting boundaries ".repeat(12), 11.5, 1.5, 18, measure);
    expect(size).toBeLessThan(18);
    expect(size).toBeGreaterThan(8);
  });
  it("removes invalid part declarations and orders notes masters before slides", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<Types><Override PartName="/ppt/slideMasters/slideMaster1.xml"/><Override PartName="/ppt/slideMasters/slideMaster2.xml"/></Types>');
    zip.file("ppt/slideMasters/slideMaster1.xml", "<master/>");
    zip.file("ppt/presentation.xml", "<p:presentation><p:sldMasterIdLst></p:sldMasterIdLst><p:sldIdLst></p:sldIdLst><p:notesMasterIdLst></p:notesMasterIdLst></p:presentation>");
    const out = await JSZip.loadAsync(await normalizePptxArchive(await zip.generateAsync({ type: "uint8array" })));
    const types = await out.file("[Content_Types].xml")?.async("string");
    expect(types).toContain("slideMaster1.xml");
    expect(types).not.toContain("slideMaster2.xml");
    const xml = await out.file("ppt/presentation.xml")?.async("string");
    expect(xml).toBe("<p:presentation><p:sldMasterIdLst></p:sldMasterIdLst><p:notesMasterIdLst></p:notesMasterIdLst><p:sldIdLst></p:sldIdLst></p:presentation>");
  });
  it("writes content types first, without folder entries or invalid MIME types", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<Types><Default Extension="jpg" ContentType="image/jpg"/><Default Extension="mp4" ContentType="video/mp4"/></Types>');
    zip.file("ppt/slides/slide1.xml", "<p:sld>a\u0008b</p:sld>");
    zip.file("ppt/media/image1.jpg", "x");
    zip.file("_rels/.rels", "<Relationships/>");
    const bytes = await normalizePptxArchive(await zip.generateAsync({ type: "uint8array" }));
    const out = await JSZip.loadAsync(bytes);
    const names = Object.keys(out.files);
    expect(names[0]).toBe("[Content_Types].xml");
    expect(names.some((n) => n.endsWith("/"))).toBe(false);
    const types = await out.file("[Content_Types].xml")?.async("string");
    expect(types).toContain('Extension="jpg" ContentType="image/jpeg"');
    expect(types).not.toContain("mp4");
    expect(await out.file("ppt/slides/slide1.xml")?.async("string")).toBe("<p:sld>ab</p:sld>");
  });
  it("keeps only one leading paragraph-properties element per paragraph", () => {
    const xml = '<a:p><a:pPr indent="0"><a:buNone/></a:pPr><a:r><a:t>2,475</a:t></a:r><a:pPr indent="0"><a:buNone/></a:pPr><a:r><a:t>assigned</a:t></a:r><a:pPr/><a:endParaRPr/></a:p>';
    expect(fixParagraphProperties(xml)).toBe('<a:p><a:pPr indent="0"><a:buNone/></a:pPr><a:r><a:t>2,475</a:t></a:r><a:r><a:t>assigned</a:t></a:r><a:endParaRPr/></a:p>');
  });
  it("uses ZIP compression compatible with the declared extraction version in every header", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    zip.file("ppt/slides/slide1.xml", "<slide>" + "customer value ".repeat(100) + "</slide>");
    const bytes = await normalizePptxArchive(await zip.generateAsync({ type: "uint8array" }));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let localHeaders = 0;
    let centralHeaders = 0;
    for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x04034b50) {
        localHeaders += 1;
        expect(view.getUint16(offset + 8, true)).toBe(0);
        expect(view.getUint16(offset + 4, true)).toBeGreaterThanOrEqual(10);
      } else if (signature === 0x02014b50) {
        centralHeaders += 1;
        expect(view.getUint16(offset + 10, true)).toBe(0);
        expect(view.getUint16(offset + 6, true)).toBeGreaterThanOrEqual(10);
      }
    }
    expect(localHeaders).toBe(2);
    expect(centralHeaders).toBe(2);
    const out = await JSZip.loadAsync(bytes, { checkCRC32: true });
    expect(await out.file("ppt/slides/slide1.xml")?.async("string")).toContain("customer value ".repeat(100));
  });
});
