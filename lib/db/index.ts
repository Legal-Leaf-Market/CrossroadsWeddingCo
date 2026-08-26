import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./url";

// Single shared pg Pool + Drizzle instance for the app's server-side queries.
const globalForDb = globalThis as unknown as { __cwcPool?: Pool };

export const pool =
  globalForDb.__cwcPool ?? new Pool({ connectionString: resolveDatabaseUrl()?.url });

if (process.env.NODE_ENV !== "production") globalForDb.__cwcPool = pool;

export const db = drizzle(pool, { schema });
