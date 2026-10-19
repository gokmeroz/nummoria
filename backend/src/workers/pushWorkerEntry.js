// Entry point for the push notification + reminder workers.
//
// The workers read Notification/Transaction/Device from MongoDB, so the
// connection must exist before they pick up jobs — otherwise every query
// sits in Mongoose's command buffer until it times out. Env is loaded first
// (config/env.js runs dotenv on import), then the DB, then the workers.
import "../config/env.js";
import { connectDB } from "../config/db.js";

await connectDB();
await import("./pushWorker.js");
await import("./reminderWorker.js");
console.log("[push-worker] started");
