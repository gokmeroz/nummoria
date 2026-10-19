// backend/src/eval/datasets/synthetic/pdfRender.js
//
// Statement text -> a real, text-layer PDF (monospace, one text line per
// statement line, page break every ~45 lines). Used by the bulk generator
// and by the eval's pdf-binary track, which runs these PDFs through
// ai/pdfText.js (pdf-parse) before parsing. These are digitally generated
// PDFs: they say nothing about scanned documents or OCR.
import { jsPDF } from "jspdf";

export function pdfBytesFromText(text) {
  const doc = new jsPDF();
  doc.setFont("courier");
  doc.setFontSize(10);
  let y = 10;
  for (const line of text.split("\n")) {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
    doc.text(line.slice(0, 100), 10, y);
    y += 6;
  }
  return Buffer.from(doc.output("arraybuffer"));
}
