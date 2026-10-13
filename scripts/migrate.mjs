// Applies db/schema.sql and upserts data/registry.json into the tokens table.
// Usage: DATABASE_URL=... npm run db:migrate
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnvFile() {
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await readFile(path.join(root, name), "utf8");
      for (const line of text.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file not present */
    }
  }
}

await loadEnvFile();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  const schema = await readFile(path.join(root, "db", "schema.sql"), "utf8");
  await client.query(schema);
  console.log("✓ schema applied");

  const registry = JSON.parse(await readFile(path.join(root, "data", "registry.json"), "utf8"));
  let n = 0;
  for (const t of registry.tokens) {
    await client.query(
      `INSERT INTO tokens (mint, symbol, name, chain, listed, status, launch_platform, era, categories, legend_rank, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       ON CONFLICT (mint) DO UPDATE SET
         symbol = EXCLUDED.symbol, name = EXCLUDED.name, chain = EXCLUDED.chain,
         listed = EXCLUDED.listed, status = EXCLUDED.status,
         launch_platform = EXCLUDED.launch_platform, era = EXCLUDED.era,
         categories = EXCLUDED.categories, legend_rank = EXCLUDED.legend_rank,
         updated_at = now()`,
      [t.mint, t.symbol, t.name, t.chain, t.listed, t.status ?? null, t.launchPlatform ?? null, t.era ?? null, t.categories ?? [], t.legendRank ?? null],
    );
    n++;
  }
  console.log(`✓ ${n} registry tokens upserted`);

  const { rowCount } = await client.query(`DELETE FROM vote_nonces WHERE expires_at < now() - interval '1 day'`);
  if (rowCount) console.log(`✓ pruned ${rowCount} expired vote challenges`);
} finally {
  await client.end();
}
