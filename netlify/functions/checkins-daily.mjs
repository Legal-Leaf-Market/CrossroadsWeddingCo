// The 90/30/14-days-out check-in texts (CLAUDE.md §9.4). Declared in
// vercel.json since 2026-08-28, but the site moved to Netlify, which ignores
// that file, so the job never ran there. It still sends nothing until the
// Twilio keys exist (the route fails closed).
import { runJob } from "../lib/run-job.mjs";

export default async () => runJob("checkins", "/api/cron/checkins");

export const config = { schedule: "0 15 * * *" };
