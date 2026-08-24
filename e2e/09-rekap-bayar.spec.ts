import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { readSheetRaw } from "./helpers/excel-reader";
import { RekapBayarPage, type RekapBayarCase } from "./pages/RekapBayarPage";
import { apiLogin, deleteRekapBayarForPeriod, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-rekap-bayar.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");
const DOWNLOAD_DIR = path.resolve(import.meta.dirname, "downloadedFile");

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

/** Kolom tetap; sisanya dianggap select non-reguler (header = label di modal). */
const FIXED = new Set(["id", "action", "paymentDate", "paymentPeriod", "reportType", "approveNote"]);

function toCase(headers: string[], row: Record<string, string | number>): RekapBayarCase {
  const nonRegular: Record<string, string> = {};
  for (const h of headers) {
    if (FIXED.has(h)) continue;
    const v = s(row[h]);
    if (v) nonRegular[h] = v;
  }
  return {
    id: row.id,
    action: s(row.action).toLowerCase(),
    paymentDate: s(row.paymentDate),
    paymentPeriod: s(row.paymentPeriod),
    reportType: s(row.reportType),
    approveNote: s(row.approveNote),
    nonRegular,
  };
}

function sanitize(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function assertExcelFile(filePath: string): void {
  if (!fs.existsSync(filePath)) throw new Error(`File download tidak ditemukan: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (stat.size === 0) throw new Error(`File download kosong: ${filePath}`);
  console.log(`[rekap-bayar] downloaded: ${filePath} (${stat.size} bytes)`);
}

const sheet = readSheetRaw(DATA_FILE, "RekapBayar");
const cases = sheet.rows.map((row) => toCase(sheet.headers, row));

test.describe("Rekap Bayar", () => {
  test.use({ storageState: STORAGE_STATE });

  test.beforeAll(async () => {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const { token } = await apiLogin(API_CFG);
    // Hanya rekap bayar yang dibersihkan. Payroll-report dan jurnal memo periode
    // ini sengaja dibiarkan -- keduanya prasyarat generate rekap bayar.
    for (const period of new Set(cases.map((c) => c.paymentPeriod))) {
      await deleteRekapBayarForPeriod(API_CFG, token, period);
    }
  });

  for (const c of cases) {
    const label = Object.entries(c.nonRegular)
      .map(([k, v]) => `${k.replace(/^Non Reguler /, "").replace(/ Type$/, "")}=${v}`)
      .join(", ");

    test(`[Rekap Bayar] ${c.action} - ${c.paymentPeriod} (${label}) (#${c.id})`, async ({ page }) => {
      const p = new RekapBayarPage(page);

      await p.goto();
      await p.generate(c);

      await p.openReportDetail(c);
      await p.approve(c.approveNote);

      const filePath = path.join(DOWNLOAD_DIR, `rekap_bayar_${sanitize(c.reportType)}_${c.paymentPeriod}.xlsx`);
      await p.downloadExcel(filePath);
      assertExcelFile(filePath);
    });
  }
});
