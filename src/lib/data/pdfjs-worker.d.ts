// pdf.js ships its worker bundle without type declarations; it is loaded on the page as the
// in-thread message handler (see readPdfPages).
declare module "pdfjs-dist/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
