import pg from "pg";

const { Pool } = pg;

const needsSsl = (() => {
  const url = process.env.DATABASE_URL || "";
  if (!url) return false;
  // Railway-managed Postgres requires SSL in prod; local dev usually doesn't.
  return /railway|rlwy|amazonaws|render|supabase/.test(url);
})();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("pg pool error", err);
});
