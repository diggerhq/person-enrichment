import { neon } from "@neondatabase/serverless";
export async function quotaQuery(
  sql: string,
  parameters: (string | number)[] = [],
) {
  const url = process.env.GTM_DATABASE_URL;
  if (!url) throw new Error("Shared limits are not configured.");
  return neon(url).query(sql, parameters, {
    fetchOptions: { signal: AbortSignal.timeout(10000) },
  });
}
