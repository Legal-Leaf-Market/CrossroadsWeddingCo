// Daily backup sync of every bank feed, in case a Plaid webhook never arrived.
// Runs /api/cron/bank-sync (app/api/cron/bank-sync/route.ts). 11:17 UTC is
// 6:17 or 7:17 in the morning in Indiana, before anyone opens the books.
import { runJob } from "../lib/run-job.mjs";

export default async () => runJob("bank-sync", "/api/cron/bank-sync");

export const config = { schedule: "17 11 * * *" };
