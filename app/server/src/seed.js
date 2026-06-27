import "dotenv/config";
import { initDb } from "./db.js";

// initDb crée le schéma + seed l'admin de façon idempotente.
await initDb();
process.exit(0);
