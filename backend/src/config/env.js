import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env is one level up from /src
dotenv.config({ path: path.join(__dirname, "../../.env") });

export const requireEnv = (k) => {
  const v = process.env[k];
  if (!v || !v.trim()) throw new Error(`Missing env: ${k}`);
  return v.trim();
};
