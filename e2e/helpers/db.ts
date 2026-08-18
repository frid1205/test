import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { DB_CONFIG, CLEARDATA_SQL_PATH } from "../config";

export interface DbCleanupResult {
  statements: number;
  rowCount: number;
}

// Hapus komentar SQL (baris -- dan blok slash-star) agar query yang hanya berisi komentar dianggap kosong.
function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

/** Ambil kredensial + file SQL lalu jalankan sebagai satu batch terhadap PostgreSQL. */
export async function runSqlCleanup(): Promise<DbCleanupResult> {
  const sqlPath = path.resolve(process.cwd(), CLEARDATA_SQL_PATH);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`runSqlCleanup: file SQL tidak ditemukan: ${sqlPath}`);
  }
  const sql = stripSqlComments(fs.readFileSync(sqlPath, "utf8")).trim();
  if (!sql) {
    console.log("[sql cleanup] cleardata.sql kosong — tidak ada yang dihapus.");
    return { statements: 0, rowCount: 0 };
  }

  const client = new pg.Client({ ...DB_CONFIG, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    const rowCount = results.reduce((n, r) => n + (r.rowCount ?? 0), 0);
    console.log(`[sql cleanup] selesai: ${results.length} statement, total baris terpengaruh ${rowCount}`);
    return { statements: results.length, rowCount };
  } finally {
    await client.end().catch(() => {});
  }
}
