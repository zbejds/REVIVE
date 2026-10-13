import "server-only";
import { Pool, type PoolClient } from "pg";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __encorePool: Pool | undefined;
}

export function db(): Pool | null {
  if (!env.databaseUrl) return null;
  if (!global.__encorePool) {
    global.__encorePool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 20_000,
    });
  }
  return global.__encorePool;
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const pool = db();
  if (!pool) throw new Error("Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
