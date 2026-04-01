import dotenv from "dotenv";
import mongoose from "mongoose";

import { User } from "../models/user.js";
import { seedDefaultCategoriesForUser } from "../services/categorySeedService.js";
import { connectDB } from "../config/db.js"; // <- use your real DB helper path

dotenv.config();

async function main() {
  console.log("Starting backfillUserCategories script...");

  await connectDB(); // <- DO NOT use mongoose.connect(...) directly here

  const users = await User.find({}).select("_id email");

  console.log(`Found ${users.length} users`);

  for (const user of users) {
    const result = await seedDefaultCategoriesForUser(user._id);
    console.log(
      `[categories] ${user.email} -> added ${result.added} missing categories`,
    );
  }

  await mongoose.connection.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
