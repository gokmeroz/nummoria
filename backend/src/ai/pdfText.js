// backend/src/ai/pdfText.js
//
// The one place a PDF buffer becomes text. Both ingest controllers go through
// here on purpose: pdf-parse bundles its own pdfjs-dist, and pdfjs registers
// its worker on globalThis, so a second pdfjs copy in the same process fails
// with "API version does not match the Worker version" on whichever runs
// second. One engine per process — do not import pdfjs-dist directly elsewhere.
import { PDFParse } from "pdf-parse";

/**
 * Extract line-preserving text from a PDF buffer. Each visual row of the
 * document comes back as its own "\n"-terminated line, which is what the
 * line-oriented parsers downstream (ai/pdfParser.js, ingestController's
 * regex) assume.
 *
 * Returns "" for a PDF with no text layer (e.g. a scan); throws pdf-parse's
 * own exceptions (InvalidPDFException, PasswordException) on unreadable input.
 */
export async function extractPdfText(pdfBuffer) {
  // pdfjs may transfer (detach) the buffer it is handed; give it a copy so
  // the caller's upload buffer stays usable.
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });

  try {
    // pageJoiner defaults to a "-- 1 of 3 --" marker line between pages,
    // which downstream parsers would see as statement content.
    const { text } = await parser.getText({ pageJoiner: "" });
    return (text || "").replace(/\u0000/g, "");
  } finally {
    await parser.destroy();
  }
}
