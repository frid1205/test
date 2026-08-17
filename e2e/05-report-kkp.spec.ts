import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { readAllSheets, type ExcelRow } from "./helpers/excel-reader";
import { ReportKkpPage, REGULAR_REPORT_TYPES, type ReportKkpCase } from "./pages/ReportKkpPage";
import { apiLogin, cleanupReportKkpPeriod, getPayrollReportsByPeriodApi, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-report-kkp.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");
const DOWNLOAD_DIR = path.resolve(import.meta.dirname, "downloadedFile");
const PERIOD = "2026-01";
const REVIEW_REASON = "HC approved mohon vice president review laporan payrollnya";

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function toCase(row: ExcelRow): ReportKkpCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase(),
    period: s(row.period),
    reportType: s(row.reporttype),
    interval: s(row.interval),
  };
}

function sanitize(reportType: string, interval: string): string {
  const t = reportType.replaceAll(/\s+/g, "_");
  const i = interval ? `_${interval.replaceAll(/\s+/g, "_")}` : "";
  return `${t}${i}.xlsx`;
}

function assertExcelFile(filePath: string): void {
  if (!fs.existsSync(filePath)) throw new Error(`File download tidak ditemukan: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (stat.size === 0) throw new Error(`File download kosong: ${filePath}`);
  console.log(`[kkp] downloaded: ${filePath} (${stat.size} bytes)`);
}

const sheets = readAllSheets(DATA_FILE);
const cases = (sheets.ReportKKP ?? []).map(toCase);

test.describe("Report KKP", () => {
  test.use({ storageState: STORAGE_STATE });

  test.beforeAll(async () => {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      // Jangan hapus hasil download Jurnal Memo (prefix moju_) agar spec lain
      // yang berbagi folder downloadedFile tidak saling menghapus artefak.
      if (f.startsWith("moju_")) continue;
      fs.rmSync(path.join(DOWNLOAD_DIR, f), { force: true, recursive: true });
    }
    const { token } = await apiLogin(API_CFG);
    await cleanupReportKkpPeriod(API_CFG, token, PERIOD);
  });

  for (const c of cases) {
    test(`[Report KKP] ${c.action} - ${c.reportType} (${c.interval || "Monthly"}) (#${c.id})`, async ({ page }) => {
      const { token } = await apiLogin(API_CFG);
      const p = new ReportKkpPage(page, c.period);

      await p.goto();
      await p.generate(c);

      if (c.reportType === "Report Reguler") {
        const items = await getPayrollReportsByPeriodApi(API_CFG, token, c.period);
        const subs = items.filter((i) => REGULAR_REPORT_TYPES.has(i.report_type));
        expect(subs.length).toBeGreaterThan(0);
        for (const item of subs) {
          await p.openPeriodDetail();
          await p.openReportDetail(item.report_type);
          await p.review(REVIEW_REASON);
          const filePath = path.join(DOWNLOAD_DIR, `sub_${sanitize(item.report_type, item.interval || "")}`);
          await p.downloadExcel(filePath);
          assertExcelFile(filePath);
        }
      } else {
        await p.openPeriodDetail();
        await p.openReportDetail(c.reportType);
        await p.review(REVIEW_REASON);
        const filePath = path.join(DOWNLOAD_DIR, sanitize(c.reportType, c.interval));
        await p.downloadExcel(filePath);
        assertExcelFile(filePath);
      }
    });
  }
});