import { type Locator, type Page, type Request, type Response, expect } from "@playwright/test";
import { MONTH_NAMES_ID, pickMonth } from "../helpers/ui";

export interface ReportKkpCase {
  id: string | number;
  action: string;
  period: string; // YYYY-MM
  reportType: string;
  interval: string; // "" untuk Report Reguler (tanpa interval)
}

/** Tipe laporan reguler (sub-report yang dibuat oleh "Report Reguler"). */
export const REGULAR_REPORT_TYPES = new Set([
  "Payroll List",
  "Transfer",
  "Daftar Transfer Potongan",
  "Master Daftar Gaji",
  "Master Benefit Medical",
  "Master Benefit Pulsa",
  "Master Benefit District",
  "Master Benefit Lembur",
  "Master Potongan Homestaff",
  "Master Potongan Expat Local",
  "Master Prorate",
  "Master Prorate Others",
]);

/**
 * Report untuk komponen custom benefit dinamai "Report KKP - <judul benefit>"
 * (useGenerateReportModal.ts: `Report KKP - ${b.title}`). Judulnya dibaca dari
 * server, jadi jangan di-hardcode -- cukup cocokkan prefiksnya.
 */
export const CUSTOM_BENEFIT_REPORT_PREFIX = "Report KKP - ";

/**
 * Sub-report yang dihasilkan "Report Reguler": tipe reguler bawaan + setiap
 * komponen custom benefit aktif (useGenerateReportModal.ts menambahkannya ke
 * `regularReportTypes`). Keduanya perlu di-review dan di-download di spec 07.
 */
export function isRegularSubReport(reportType: string): boolean {
  return REGULAR_REPORT_TYPES.has(reportType) || reportType.startsWith(CUSTOM_BENEFIT_REPORT_PREFIX);
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GROUP_BY_TYPE: Record<string, string> = {
  "Non Regular Salary BFKJ": "Non Regular Salary",
  "Non Regular Salary Hometrip": "Non Regular Salary",
  "Non Regular Cutah": "Non Regular Salary",
  "Non Regular Gaji ke-13": "Non Regular Salary",
  "Non Regular Tunjangan Kompetensi": "Non Regular Salary",
  "Master Benefit Medical": "Benefit",
  "Master Benefit Pulsa": "Benefit",
  "Master Benefit District": "Benefit",
  "Master Benefit Lembur": "Benefit",
  "Master Potongan Homestaff": "Salary Deduction",
  "Master Potongan Expat Local": "Salary Deduction",
  // useReportGrouping.ts GROUP_CONFIG menempatkannya di "Salary Deduction",
  // bukan "Salary Payment" -- salah group berarti barisnya tidak pernah ter-expand.
  "Daftar Transfer Potongan": "Salary Deduction",
  "Master Prorate": "Other & Prorate",
  "Master Prorate Others": "Other & Prorate",
  "Master Daftar Gaji": "Salary Payment",
  "Payroll List": "Salary Payment",
  "Transfer": "Salary Payment",
};

/**
 * Label group di tabel period-detail, mengikuti useReportGrouping.ts:
 * 1. "Report KKP - <benefit>" -> digabung ke group "Benefit";
 * 2. tipe bawaan -> GROUP_BY_TYPE (mirror GROUP_CONFIG.matches);
 * 3. sisanya = custom non-regular dari non-regular-setting (mis. "tunjangan
 *    jabatan 2") -> group "Non Regular Salary". Namanya data dinamis, jadi
 *    memang tidak bisa dihardcode di GROUP_BY_TYPE.
 */
function groupLabelFor(reportType: string): string {
  if (reportType.startsWith(CUSTOM_BENEFIT_REPORT_PREFIX)) return "Benefit";
  return GROUP_BY_TYPE[reportType] ?? "Non Regular Salary";
}

/** Backend membalas 500 dengan pesan ini kalau sub-report tidak punya data untuk periode tsb. */
const EMPTY_DATA_MESSAGE = /Data is empty\. Cannot generate report snapshot/;

const PERIOD_INPUT_ID = "lbl_273217_period_263";
const REPORT_TYPE_TRIGGER_ID = "lbl_273217_report_type_278";
const INTERVAL_TRIGGER_ID = "lbl_273217_interval_334";

export class ReportKkpPage {
  private readonly dialog: Locator;

  constructor(
    private readonly page: Page,
    private readonly period: string,
  ) {
    this.dialog = page.getByRole("dialog");
  }

  get periodLabel(): string {
    const [year, month] = this.period.split("-");
    return `${year} - ${MONTH_SHORT[Number(month) - 1]}`;
  }

  private async gotoReportMaster(): Promise<void> {
    await this.page.goto("/report-master");
    await expect(this.page.getByRole("button", { name: "+ Generate Report" })).toBeVisible({ timeout: 60_000 });
  }

  async goto(): Promise<void> {
    await this.gotoReportMaster();
  }

  private async openGenerateModal(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Generate Report" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByText("Generate Report Snapshot")).toBeVisible({ timeout: 30_000 });
  }

  private async fillPeriod(): Promise<void> {
    const [year, month] = this.period.split("-");
    await pickMonth(this.page, this.dialog.locator(`#${PERIOD_INPUT_ID}`), MONTH_NAMES_ID[Number(month) - 1], year);
  }

  private async selectOption(trigger: Locator, optionLabel: string): Promise<void> {
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await expect(trigger).toBeEnabled({ timeout: 30_000 }).catch(() => undefined);
    await trigger.click();
    const option = this.page.getByRole("option", { name: optionLabel, exact: true }).last();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
  }

  /** Interval label UI ("Yearly" untuk value 'yearly'); "" berarti tidak dipilih. */
  private intervalLabel(interval: string): string {
    return interval === "yearly" ? "Yearly" : interval;
  }

  async generate(data: ReportKkpCase): Promise<void> {
    // Modal langsung memanggil GET /payroll-reports/check-empty untuk bulan
    // berjalan saat dibuka, lalu sekali lagi setelah period diganti. Hasilnya
    // (`emptyReports`) yang menentukan sub-report mana yang DIKIRIM saat
    // "Report Reguler" di-generate (generateReportHelpers.ts:57). Kalau tombol
    // Generate diklik sebelum check untuk period yang benar selesai, frontend
    // memakai hasil period lama -- sebagian sub-report ter-skip dan tidak
    // pernah terbentuk. Penunggu didaftarkan SEBELUM modal dibuka supaya
    // response-nya tidak terlewat.
    const emptyCheckDone = this.page.waitForResponse(
      (r) => r.url().includes("/payroll-reports/check-empty") && r.url().includes(`period=${this.period}`),
      { timeout: 60_000 },
    );

    await this.openGenerateModal();
    await this.fillPeriod();
    await emptyCheckDone;
    await this.selectOption(this.dialog.locator(`#${REPORT_TYPE_TRIGGER_ID}`), data.reportType);

    if (data.interval && data.reportType !== "Report Reguler") {
      const intervalTrigger = this.dialog.locator(`#${INTERVAL_TRIGGER_ID}`);
      await expect(intervalTrigger).toBeVisible({ timeout: 30_000 });
      await this.selectOption(intervalTrigger, this.intervalLabel(data.interval));
    }

    // Report Reguler memicu banyak POST /payroll-reports/generate (satu per
    // sub-report). Kumpulkan SEMUA response -- menunggu response pertama saja
    // membuat kegagalan sub-report lain (mis. 500 "Data is empty") tidak
    // terlihat, dan baru muncul jauh kemudian sebagai timeout locator.
    const failures: string[] = [];
    const pending: Array<Promise<void>> = [];
    const isGenerateRequest = (r: Request): boolean =>
      r.method() === "POST" && r.url().includes("/payroll-reports/generate");

    // Hitung request yang masih berjalan. Navigasi/refresh saat masih ada POST
    // generate di udara akan membatalkannya -- report-nya tidak terbentuk.
    let inFlight = 0;
    const onRequest = (r: Request): void => {
      if (isGenerateRequest(r)) inFlight += 1;
    };
    const onSettled = (r: Request): void => {
      if (isGenerateRequest(r)) inFlight -= 1;
    };
    const onResponse = (r: Response): void => {
      if (!isGenerateRequest(r.request())) return;
      if (r.ok()) return;
      pending.push(
        r
          .text()
          .catch(() => "")
          .then((body) => {
            failures.push(`${r.status()} ${body}`);
          }),
      );
    };

    this.page.on("request", onRequest);
    this.page.on("requestfinished", onSettled);
    this.page.on("requestfailed", onSettled);
    this.page.on("response", onResponse);
    try {
      await this.dialog.getByRole("button", { name: "Generate", exact: true }).click();
      // Modal baru ditutup frontend setelah seluruh sub-report selesai dikirim
      // (useGenerateReportModal.ts: handleClose() dipanggil sesudah await),
      // jadi form yang hilang = tanda semua generate sudah dijalankan.
      await expect(this.dialog).toBeHidden({ timeout: 120_000 });
      await expect(this.page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
      // ...dan pastikan tidak ada POST generate yang masih menggantung sebelum
      // pemanggil pindah halaman.
      await expect
        .poll(() => inFlight, {
          timeout: 120_000,
          message: "Masih ada POST /payroll-reports/generate berjalan saat form generate sudah tertutup",
        })
        .toBe(0);
    } finally {
      this.page.off("request", onRequest);
      this.page.off("requestfinished", onSettled);
      this.page.off("requestfailed", onSettled);
      this.page.off("response", onResponse);
    }
    await Promise.all(pending);

    // Sub-report "core" (Payroll List, Transfer, Master Daftar Gaji, Daftar
    // Transfer Potongan) tetap dikirim frontend walau check-empty menandainya
    // kosong (generateReportHelpers.ts:44 -> CORE_REGULAR_TYPES), dan backend
    // membalasnya 500 "Data is empty" alih-alih "skipped". Itu kondisi data,
    // bukan kegagalan generate -- barisnya memang tidak dibuat dan loop review
    // di spec tidak akan mencarinya karena daftar sub-report dibaca dari
    // /payroll-reports/by-period. Dilewati, tapi tetap dicatat di log.
    const skipped = failures.filter((f) => EMPTY_DATA_MESSAGE.test(f));
    const blocking = failures.filter((f) => !EMPTY_DATA_MESSAGE.test(f));
    if (skipped.length) {
      console.warn(
        `[generate] ${skipped.length} sub-report dilewati karena datanya kosong untuk periode ini:\n${skipped.join("\n")}`,
      );
    }

    expect(
      blocking,
      `${blocking.length} POST /payroll-reports/generate gagal:\n${blocking.join("\n")}`,
    ).toEqual([]);
  }


  /** Buka halaman period-detail via list di /report-master (klik baris periode). */
  async openPeriodDetail(): Promise<void> {
    await this.gotoReportMaster();
    const row = this.page.locator("tbody tr").filter({ hasText: this.periodLabel }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByRole("button", { name: "View" }).first().click();
    await expect(this.page.getByText("Detail Report List")).toBeVisible({ timeout: 60_000 });
  }

  async openReportDetail(reportType: string): Promise<void> {
    const viewButton = this.page.getByRole("button", { name: `View ${reportType} report` }).first();
    const groupLabel = groupLabelFor(reportType);

    const groupRow = this.page.locator("tbody tr").filter({ hasText: groupLabel }).first();
    await expect(groupRow).toBeVisible({ timeout: 30_000 });
    // Probe isVisible() baru dilakukan setelah tabel render, jadi hasilnya
    // benar-benar menjawab "group ini sudah ter-expand?" dan bukan balapan.
    if (!(await viewButton.isVisible())) {
      await groupRow.click();
    }
    await expect(
      viewButton,
      `Baris "${reportType}" tidak muncul setelah group "${groupLabel}" di-expand`,
    ).toBeVisible({ timeout: 30_000 });
    await viewButton.click();
    await expect(this.page.getByRole("button", { name: "Export Excel" }).first()).toBeVisible({ timeout: 60_000 });
  }

  /** Review (HR) lewat modal Proceed Document dengan keterangan tertentu. */
  async review(reason: string): Promise<void> {
    const proceedBtn = this.page.getByRole("button", { name: "Proceed Data" }).first();
    await expect(proceedBtn).toBeVisible({ timeout: 60_000 });
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/payroll-reports/review/") && r.request().method() === "POST",
      { timeout: 120_000 },
    );
    await proceedBtn.click();
    const modal = this.page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.locator("textarea#reason").fill(reason);
    await modal.getByRole("button", { name: "Approve", exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST /payroll-reports/review -> ${response.status()}: ${await response.text()}`);
    }
    await expect(modal).toBeHidden({ timeout: 120_000 });
    await expect(this.page.getByText("Status Reviewed by HR")).toBeVisible({ timeout: 30_000 });
  }

  async downloadExcel(savePath: string): Promise<void> {
    const downloadPromise = this.page.waitForEvent("download", { timeout: 120_000 });
    await this.page.getByRole("button", { name: "Export Excel", exact: true }).first().click();
    const download = await downloadPromise;
    if (!download.suggestedFilename().toLowerCase().endsWith(".xlsx")) {
      throw new Error(`Unexpected download filename: ${download.suggestedFilename()}`);
    }
    await download.saveAs(savePath);
  }
}