// backend/src/config/db.js
import mongoose from "mongoose";

export async function connectDB() {
  const isProd = process.env.NODE_ENV === "production";
  const uri = isProd ? process.env.MONGO_URI_PROD : process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      isProd
        ? "MONGO_URI_PROD not set (production)"
        : "MONGO_URI not set (development)",
    );
  }

  if (isProd) {
    const lowered = uri.toLowerCase();

    if (lowered.includes("localhost") || lowered.includes("127.0.0.1")) {
      throw new Error(
        "Refusing to start: production DB URI points to localhost.",
      );
    }

    // Extra guard: do not allow prod to use the same string as dev by mistake
    if (
      process.env.MONGO_URI &&
      process.env.MONGO_URI_PROD === process.env.MONGO_URI
    ) {
      throw new Error("Refusing to start: MONGO_URI_PROD equals MONGO_URI.");
    }

    if (lowered.includes("dev") || lowered.includes("test")) {
      throw new Error(
        "Refusing to start: production DB URI looks like dev/test.",
      );
    }
  }

  await mongoose.connect(uri, {
    autoIndex: !isProd,
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`✅ MongoDB connected (${isProd ? "PROD" : "DEV"})`);
}
