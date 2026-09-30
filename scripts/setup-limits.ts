import { readFileSync } from "node:fs";
import { quotaQuery } from "../web/src/lib/quota-db.js";
const source = readFileSync(
  new URL("../web/database/limits.sql", import.meta.url),
  "utf8",
);
// Split only the top-level DDL; the function body contains its own semicolons.
const marker = source.indexOf("CREATE OR REPLACE FUNCTION");
for (const statement of source
  .slice(0, marker)
  .split(";")
  .filter((s) => s.trim()))
  await quotaQuery(statement);
await quotaQuery(source.slice(marker));
console.log("Shared quota schema and atomic admission function configured.");
