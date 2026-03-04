// backend/src/config/db.js
import mongoose from "mongoose";

export async function connectDB() {
  const isRuntimeProd = process.env.NODE_ENV === "production"; // cookies/security/etc
  const useProdDb = (process.env.DB_TARGET || "").toLowerCase() === "prod";

  const uri = useProdDb ? process.env.MONGO_URI_PROD : process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      useProdDb
        ? "MONGO_URI_PROD not set (DB_TARGET=prod)"
        : "MONGO_URI not set",
    );
  }

  if (useProdDb) {
    const lowered = uri.toLowerCase();

    if (lowered.includes("localhost") || lowered.includes("127.0.0.1")) {
      throw new Error("Refusing to start: PROD DB URI points to localhost.");
    }

    if (
      process.env.MONGO_URI &&
      process.env.MONGO_URI_PROD === process.env.MONGO_URI
    ) {
      throw new Error("Refusing to start: MONGO_URI_PROD equals MONGO_URI.");
    }

    if (lowered.includes("dev") || lowered.includes("test")) {
      throw new Error("Refusing to start: PROD DB URI looks like dev/test.");
    }
  }

  await mongoose.connect(uri, {
    autoIndex: !isRuntimeProd, // index behavior should follow runtime, not DB target
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`✅ MongoDB connected (${useProdDb ? "PROD DB" : "DEV DB"})`);
}
