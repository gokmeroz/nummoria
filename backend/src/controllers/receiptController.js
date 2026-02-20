// backend/src/controllers/receiptController.js
import { extractReceiptFromImage } from "../services/receiptOcrService.js";

export async function receiptParse(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Missing file. Send multipart/form-data with field name 'file'.",
        rid: req.id,
      });
    }

    const { buffer, mimetype, originalname } = req.file;

    const result = await extractReceiptFromImage({
      buffer,
      mimetype,
      filename: originalname,
    });

    // Always return a stable shape (mobile expects these keys)
    return res.json({
      amount: result.amount ?? null,
      currency: result.currency ?? null,
      date: result.date ?? null, // YYYY-MM-DD preferred
      seller: result.seller ?? null,
      description: result.description ?? null,
      rawText: result.rawText ?? "",
      provider: result.provider ?? "none",
    });
  } catch (err) {
    next(err);
  }
}
