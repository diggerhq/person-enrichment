import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { quotaQuery } from "../web/src/lib/quota-db.js";
import { RESERVE_SQL, RELEASE_SQL } from "../web/src/lib/limit-sql.js";
const daily = `limit-test-${randomUUID()}`,
  concurrent = `limit-test-${randomUUID()}`;
const reserve = (scope: string, ip: string) =>
  quotaQuery(RESERVE_SQL, [randomUUID(), scope, ip]);
try {
  await quotaQuery(
    `INSERT INTO gtm_enrichment_demo.requests
 SELECT gen_random_uuid(), $1, (now() AT TIME ZONE 'UTC')::date, 'seed', '-infinity'::timestamptz FROM generate_series(1,95)`,
    [daily],
  );
  const dailyResults = await Promise.all(
    Array.from({ length: 20 }, (_, i) => reserve(daily, `test-ip-${i}`)),
  );
  assert.equal(
    dailyResults.filter((rows) => rows[0].outcome === "admitted").length,
    5,
  );
  assert.equal(
    dailyResults.filter((rows) => rows[0].outcome === "daily_limit").length,
    15,
  );
  const concurrentResults = await Promise.all(
    Array.from({ length: 12 }, () => reserve(concurrent, "same-test-ip")),
  );
  assert.equal(
    concurrentResults.filter((rows) => rows[0].outcome === "admitted").length,
    5,
  );
  assert.equal(
    concurrentResults.filter((rows) => rows[0].outcome === "ip_limit").length,
    7,
  );
  assert.equal(
    (await reserve(concurrent, "different-ip"))[0].outcome,
    "admitted",
  );
  const [first] = await quotaQuery(
    "SELECT id FROM gtm_enrichment_demo.requests WHERE scope=$1 AND ip_hash=$2 LIMIT 1",
    [concurrent, "same-test-ip"],
  );
  await quotaQuery(RELEASE_SQL, [first.id, concurrent]);
  assert.equal(
    (await reserve(concurrent, "same-test-ip"))[0].outcome,
    "admitted",
  );
  await quotaQuery(RELEASE_SQL, [first.id, concurrent]);
  assert.equal(
    (await reserve(concurrent, "same-test-ip"))[0].outcome,
    "ip_limit",
  );
  await quotaQuery(
    "UPDATE gtm_enrichment_demo.requests SET day=(now() AT TIME ZONE 'UTC')::date - 1 WHERE scope=$1",
    [concurrent],
  );
  assert.equal(
    (await reserve(concurrent, "same-test-ip"))[0].outcome,
    "ip_limit",
  );
  await quotaQuery(
    "UPDATE gtm_enrichment_demo.requests SET active_until=now()-interval '1 second' WHERE scope=$1",
    [concurrent],
  );
  assert.equal(
    (await reserve(concurrent, "same-test-ip"))[0].outcome,
    "admitted",
  );
  console.log(
    "Parallel shared-store checks passed: cap 100/day, cap 5/IP, isolated IPs, exact release, midnight overlap and crash recovery. No enrichment calls made.",
  );
} finally {
  await quotaQuery(
    "DELETE FROM gtm_enrichment_demo.requests WHERE scope IN ($1,$2)",
    [daily, concurrent],
  );
}
