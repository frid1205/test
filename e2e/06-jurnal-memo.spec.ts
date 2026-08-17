import { test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { readAllSheets, type ExcelRow } from "./helpers/excel-reader";
import { JurnalMemoPage, type JurnalMemoCase } from "./pages/JurnalMemoPage";
import { apiLogin, cleanupJurnalMemoPeriod, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-report-kkp.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");
const DOWNLOAD_DIR = path.resolve(import.meta.dirname, "downloadedFile");
const PERIOD = "2026-01";
const YEAR = "2026";
const MONTH = "01";

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function toCase(row: ExcelRow): JurnalMemoCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase(),
    period: s(row.period),
    year: s(row.year, YEAR),
    month: s(row.month, MONTH),
    journalType: s(row.journaltype),
    journalTypeLabel: s(row.journaltypelabel, s(row.journaltype)),
    generateType: s(row.generatetype),
    payrollArea: s(row.payrollarea, "test"),
    businessArea: s(row.businessarea, "test"),
    salaryType: s(row.salarytype, "test"),
  };
}

function sanitize(label: string, generateType: string): string {
  const t = label.replaceAll(/\s+/g, "_");
  const i = generateType ? `_${generateType.replaceAll(/\s+/g, "_")}` : "";
  return `moju_${t}${i}.xlsx`;
}

function assertExcelFile(filePath: string): void {
  if (!fs.existsSync(filePath)) throw new Error(`File download tidak ditemukan: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (stat.size === 0) throw new Error(`File download kosong: ${filePath}`);
  console.log(`[jurnal-memo] downloaded: ${filePath} (${stat.size} bytes)`);
}

const sheets = readAllSheets(DATA_FILE);
const cases = (sheets.JurnalMemo ?? []).map(toCase);

test.describe("Jurnal Memo", () => {
  test.use({ storageState: STORAGE_STATE });

  test.beforeAll(async () => {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    // Hanya bersihkan file Jurnal Memo (prefix moju_) — jangan hapus hasil
    // download spec lain (mis. Report KKP) yang berbagi folder downloadedFile.
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      if (f.startsWith("moju_")) fs.rmSync(path.join(DOWNLOAD_DIR, f), { force: true, recursive: true });
    }
    const { token } = await apiLogin(API_CFG);
    await cleanupJurnalMemoPeriod(API_CFG, token, PERIOD);
  });

  for (const c of cases) {
    test(`[Jurnal Memo] ${c.action} - ${c.journalTypeLabel} (${c.generateType || "-"}) (#${c.id})`, async ({ page }) => {
      const p = new JurnalMemoPage(page);

      await p.goto();
      await p.generate(c);
      await p.openPeriodList(c.period);
      await p.openMemoDetail(c);

      const reason = `HC approved mohon vice president review laporan Moju-nya ${c.journalTypeLabel}`;
      await p.review(reason);

      const filePath = path.join(DOWNLOAD_DIR, sanitize(c.journalTypeLabel, c.generateType));
      await p.downloadExcel(filePath);
      assertExcelFile(filePath);
    });
  }
});
