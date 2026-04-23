import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

try {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
    console.log(`applied ${file}`);
  }
  console.log("migrated");
} catch (err) {
  console.error("migrate failed", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
