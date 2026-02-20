// backend/src/services/receiptOcrService.js
import sharp from "sharp";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/* --------------------- Receipt text parse helper --------------------- */
function parseReceiptFromText(rawText) {
  if (!rawText) return null;

  const textRaw = String(rawText);
  const text = textRaw.replace(/\s+/g, " ").toUpperCase();

  // AMOUNT (TOTAL)
  const totalRegex =
    /(GENEL TOPLAM|TOPLAM|TOPLAM TUTAR|ÖDENECEK|ODENECEK|TOTAL|GRAND TOTAL|AMOUNT)[^\d]*([0-9]+[.,][0-9]{2})/;
  const totalMatch = text.match(totalRegex);

  let amount = null;
  if (totalMatch?.[2]) {
    amount = totalMatch[2].replace(",", ".");
  } else {
    const allMoney = [...text.matchAll(/([0-9]{1,6}[.,][0-9]{2})/g)].map(
      (m) => m[1],
    );

    if (allMoney.length) {
      const nums = allMoney
        .map((s) => ({ s, n: Number(s.replace(",", ".")) }))
        .filter((x) => !Number.isNaN(x.n));
      if (nums.length) {
        nums.sort((a, b) => b.n - a.n);
        amount = String(nums[0].s).replace(",", ".");
      }
    }
  }

  // CURRENCY
  let currency = null;
  if (/\b(TRY|TL|₺)\b/.test(text)) currency = "TRY";
  else if (/\b(USD|\$)\b/.test(text)) currency = "USD";
  else if (/\b(EUR|€)\b/.test(text)) currency = "EUR";
  else if (/\b(GBP|£)\b/.test(text)) currency = "GBP";

  // DATE
  let dateStr = null;
  const iso = text.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})/);
  const eu = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4})/);

  if (iso) {
    dateStr = iso[1].replace(/\./g, "-").replace(/\//g, "-");
  } else if (eu) {
    const [dd, mm, yyyy] = eu[1].split(/[./-]/);
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  // SELLER (top header lines)
  let seller = null;
  const lines = textRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length) {
    const stopIdx = lines.findIndex((l) =>
      /TARİH|TARIH|DATE|FİŞ|FIS|FİŞ NO|FIS NO|FATURA|VERGI|VKN|RECEIPT/i.test(
        l,
      ),
    );
    const headerLines =
      stopIdx > 0 ? lines.slice(0, stopIdx) : lines.slice(0, 3);

    seller = headerLines.join(" ").trim();
    if (seller.length > 80) seller = seller.slice(0, 80).trim();
  }

  if (!amount && !dateStr && !seller) return null;

  return {
    amount: amount || null,
    currency: currency || null,
    date: dateStr || null,
    seller: seller || null,
  };
}

/* --------------------- Image preprocessing --------------------- */
async function preprocessToPng(inputBuffer) {
  // Receipts benefit a lot from binarization + sharpening.
  return sharp(inputBuffer)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* --------------------- OCR via system tesseract --------------------- */
async function runTesseractOnPngBuffer(pngBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nummoria-ocr-"));
  const inputPath = path.join(tmpDir, "in.png");

  try {
    await fs.writeFile(inputPath, pngBuffer);

    // Use env var OCR_LANGS if you want: "eng" or "eng+tur"
    const langs = process.env.OCR_LANGS || "eng";

    // tesseract <input> stdout -l eng --psm 6
    const args = [inputPath, "stdout", "-l", langs, "--psm", "6"];

    const { stdout } = await execFileAsync("tesseract", args, {
      timeout: 25_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return String(stdout || "").trim();
  } finally {
    // cleanup best-effort
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Return shape:
 * { amount, currency, date, seller, description, rawText, provider }
 */
export async function extractReceiptFromImage({ buffer }) {
  try {
    const png = await preprocessToPng(buffer);
    const rawText = await runTesseractOnPngBuffer(png);
    const parsed = parseReceiptFromText(rawText);

    return {
      amount: parsed?.amount ?? null,
      currency: parsed?.currency ?? null,
      date: parsed?.date ?? null,
      seller: parsed?.seller ?? null,
      description: parsed?.seller ?? null,
      rawText: rawText || "",
      provider: "tesseract-cli",
    };
  } catch (e) {
    // Do NOT throw — return stable null shape so mobile shows "Could not auto-fill"
    return {
      amount: null,
      currency: null,
      date: null,
      seller: null,
      description: null,
      rawText: "",
      provider: "tesseract-cli",
    };
  }
}
