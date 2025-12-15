// backend/src/utils/registrationToken.js
import crypto from "crypto";

const ALG = "aes-256-gcm";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function getKey() {
  const secret = process.env.REGISTRATION_TOKEN_SECRET;
  if (!secret) throw new Error("REGISTRATION_TOKEN_SECRET is missing");
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

export function createRegToken(payload) {
  const iv = crypto.randomBytes(12);
  const key = getKey();

  const cipher = crypto.createCipheriv(ALG, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // iv.tag.ciphertext
  return `${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

export function readRegToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const iv = fromB64url(parts[0]);
    const tag = fromB64url(parts[1]);
    const ciphertext = fromB64url(parts[2]);

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
}
