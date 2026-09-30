import { createHmac, randomUUID } from "node:crypto";
import { RESERVE_SQL, RELEASE_SQL } from "./limit-sql";
import { quotaQuery } from "./quota-db";
const SCOPE = "public-enrichment";
export type Permit =
  | { allowed: true; release: () => Promise<void> }
  | { allowed: false; error: string; retryAfter: number };
export async function reserveEnrichment(
  ip: string,
  scope = SCOPE,
): Promise<Permit> {
  const key = process.env.OPENCOMPUTER_API_KEY;
  if (!key) throw new Error("Shared limits are not configured.");
  const hash = createHmac("sha256", key).update(ip).digest("hex"),
    id = randomUUID();
  const rows = await quotaQuery(RESERVE_SQL, [id, scope, hash]);
  const row = rows[0];
  if (row?.outcome === "admitted")
    return {
      allowed: true,
      release: async () => {
        await quotaQuery(RELEASE_SQL, [id, scope]);
      },
    };
  if (row?.outcome === "daily_limit")
    return {
      allowed: false,
      error:
        "Today's 100 free enrichments have been used. Try again after midnight UTC, or deploy your own agent.",
      retryAfter: Math.max(1, Number(row.reset_seconds)),
    };
  if (row?.outcome === "ip_limit")
    return {
      allowed: false,
      error:
        "Your IP already has 5 enrichments running. Wait for one to finish, then try again.",
      retryAfter: 5,
    };
  throw new Error("Unexpected limits response.");
}
