import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Single shared pg Pool + Drizzle instance for the app's server-side queries.
const globalForDb = globalThis as unknown as { __cwcPool?: Pool };

export const pool =
  globalForDb.__cwcPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForDb.__cwcPool = pool;

export const db = drizzle(pool, { schema });
