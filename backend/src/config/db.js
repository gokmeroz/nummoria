import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set");

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 8000,
  });

  console.log("✅ MongoDB connected");
}
