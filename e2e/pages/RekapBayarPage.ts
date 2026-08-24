import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseSelect, formField, pickDate, pickMonth } from "../helpers/ui";

export interface RekapBayarCase {
  id: string | number;
  action: string;
  paymentDate: string; // YYYY-MM-DD
  paymentPeriod: string; // YYYY-MM
  reportType: string; // "Rekap Pembayaran" | "Bayar Gaji" | "Bukti Transfer"
  approveNote: string;
  /** Label select di modal ("Non Reguler BFKJ Type", dst.) -> interval yang dipilih. */
  nonRegular: Record<string, string>;
}

// Field id dari GeneratePayrollModal.tsx.
const PAYMENT_DATE_ID = "lbl_79d0e5_paymentdate_181";
const PAYMENT_PERIOD_ID = "lbl_79d0e5_paymentperiod_196";

/** Ambang tinggi (px) untuk membedakan panel non-reguler terbuka vs ter-collapse. */
const MIN_OPEN_PANEL_HEIGHT = 20;

export class RekapBayarPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/rekap-bayar");
    await expect(this.page.getByRole("button", { name: "Generate Rekap Bayar" })).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Panel "Show Non Reguler Filter" di-collapse lewat `grid-rows-[0fr]` +
   * overflow-hidden: isinya tetap ada di DOM dengan bounding box sendiri (jadi
   * `isVisible()` menyesatkan), hanya wrapper-nya yang tingginya 0. Ukur tinggi
   * wrapper itu supaya toggle diklik hanya kalau memang masih tertutup.
   */
  private async showNonRegularFilter(): Promise<void> {
    const panel = this.dialog.locator('div[class*="grid-rows-"]').first();
    const panelHeight = async (): Promise<number> => (await panel.boundingBox())?.height ?? 0;

    if ((await panelHeight()) < MIN_OPEN_PANEL_HEIGHT) {
      await this.dialog.getByRole("button", { name: "Show Non Reguler Filter" }).click();
    }
    await expect
      .poll(panelHeight, {
        timeout: 15_000,
        message: 'panel "Show Non Reguler Filter" tidak terbuka',
      })
      .toBeGreaterThan(MIN_OPEN_PANEL_HEIGHT);
  }


  private async fillNonRegular(data: RekapBayarCase): Promise<void> {
    for (const [label, value] of Object.entries(data.nonRegular)) {
      if (!value) continue;
      const trigger = formField(this.dialog, label).locator('[data-slot="select-trigger"]').first();
      await expect(trigger).toBeVisible({ timeout: 20_000 });
      await chooseSelect(this.page, trigger, value);
    }
  }

  async generate(data: RekapBayarCase): Promise<void> {
    await this.page.getByRole("button", { name: "Generate Rekap Bayar" }).click();
    await expect(this.dialog).toBeVisible();

    // Keduanya popover DatePicker (CInput type=date -> mode "date", type=month
    // -> mode "month"), bukan input teks.
    await pickDate(this.page, this.dialog.locator(`#${PAYMENT_DATE_ID}`), data.paymentDate);
    const [year, month] = data.paymentPeriod.split("-");
    await pickMonth(this.page, this.dialog.locator(`#${PAYMENT_PERIOD_ID}`), MONTH_NAMES_ID[Number(month) - 1], year);

    await this.showNonRegularFilter();
    await this.fillNonRegular(data);

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/generate-payroll/generate-reguler") && r.request().method() === "POST",
      { timeout: 180_000 },
    );
    await this.dialog.getByRole("button", { name: "Continue", exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      // 422 di sini biasanya berarti prasyarat KKP belum terpenuhi (report/moju
      // periode tsb belum reviewed/approved) -- pesan servernya menyebut detailnya.
      throw new Error(`POST /generate-payroll/generate-reguler -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  /** Buka /rekap-bayar -> detail periode -> salah satu dari 3 report (Rekap Pembayaran / Bayar Gaji / Bukti Transfer). */
  async openReportDetail(data: RekapBayarCase): Promise<void> {
    await this.goto();
    const periodButton = this.page.getByRole("button", { name: `View details for ${data.paymentPeriod}` });
    await expect(periodButton).toBeVisible({ timeout: 60_000 });
    await periodButton.click();

    const reportButton = this.page.getByRole("button", { name: `View details for ${data.reportType}` });
    await expect(reportButton).toBeVisible({ timeout: 60_000 });
    await reportButton.click();

    await expect(this.page.getByRole("button", { name: "Export Excel" }).first()).toBeVisible({ timeout: 60_000 });
  }

  /**
   * Jalankan tahap approval yang tersedia untuk akun uji:
   * "Proceed Document" (review HR) lalu "Approve Data" (approve VP). Tombolnya
   * hanya muncul kalau akun yang login adalah prepared_by / approved_by pada
   * report_authorization (detail-report.tsx: isAuthorized).
   */
  async approve(note: string): Promise<void> {
    const steps: Array<{ button: string; apiPath: string; statusText: string }> = [
      { button: "Proceed Document", apiPath: "/payment-receipt-notes/rekap-bayar/review", statusText: "Status Reviewed by HR" },
      { button: "Approve Data", apiPath: "/payment-receipt-notes/rekap-bayar/approve", statusText: "Status Approved by VP" },
    ];

    let done = 0;
    for (const step of steps) {
      const button = this.page.getByRole("button", { name: step.button }).first();
      if (!(await button.isVisible().catch(() => false))) {
        console.warn(`[rekap-bayar] tombol "${step.button}" tidak tersedia untuk akun ini -- tahap approval dilewati.`);
        continue;
      }

      const responsePromise = this.page.waitForResponse(
        (r) => r.url().includes(step.apiPath) && r.request().method() === "POST",
        { timeout: 120_000 },
      );
      await button.click();

      const modal = this.page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await modal.locator("textarea#reason").fill(note);
      await modal.getByRole("button", { name: "Approve", exact: true }).click();

      const response = await responsePromise;
      if (!response.ok()) {
        throw new Error(`POST ${step.apiPath} -> ${response.status()}: ${await response.text()}`);
      }
      await expect(modal).toBeHidden({ timeout: 120_000 });
      await expect(this.page.getByText(step.statusText)).toBeVisible({ timeout: 60_000 });
      console.log(`[rekap-bayar] ${step.button} OK -> ${step.statusText}`);
      done++;
    }

    expect(done, "tidak ada satupun tahap approval yang bisa dijalankan").toBeGreaterThan(0);
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
