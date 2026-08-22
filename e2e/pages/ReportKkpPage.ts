import { type Locator, type Page, type Response, expect } from "@playwright/test";
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
  "Master Prorate": "Other & Prorate",
  "Master Prorate Others": "Other & Prorate",
  "Master Daftar Gaji": "Salary Payment",
  "Payroll List": "Salary Payment",
  "Transfer": "Salary Payment",
  "Daftar Transfer Potongan": "Salary Payment",
};

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
    await this.openGenerateModal();
    await this.fillPeriod();
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
    const onResponse = (r: Response): void => {
      if (r.request().method() !== "POST" || !r.url().includes("/payroll-reports/generate")) return;
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

    this.page.on("response", onResponse);
    try {
      await this.dialog.getByRole("button", { name: "Generate", exact: true }).click();
      await expect(this.dialog).toBeHidden({ timeout: 120_000 });
    } finally {
      this.page.off("response", onResponse);
    }
    await Promise.all(pending);

    expect(
      failures,
      `${failures.length} POST /payroll-reports/generate gagal:\n${failures.join("\n")}`,
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
    const groupLabel = reportType.startsWith("Report KKP - ") ? "Benefit" : (GROUP_BY_TYPE[reportType] || "Non Regular Salary");
    if (!(await viewButton.isVisible().catch(() => false))) {
      const groupRow = this.page.locator("tbody tr").filter({ hasText: groupLabel }).first();
      await expect(groupRow).toBeVisible({ timeout: 30_000 });
      await groupRow.click();
    }
    await expect(viewButton).toBeVisible({ timeout: 30_000 });
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