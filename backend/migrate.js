import { readFileSync } from "node:fs";
import { pool } from "./db.js";

const sql = readFileSync(
  new URL("./migrations/001_init.sql", import.meta.url),
  "utf8",
);

try {
  await pool.query(sql);
  console.log("migrated");
} catch (err) {
  console.error("migrate failed", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
