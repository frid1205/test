import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_EN } from "../helpers/ui";

export interface JurnalMemoCase {
  id: string | number;
  action: string;
  period: string; // YYYY-MM
  year: string;
  month: string; // 01..12
  journalType: string; // nilai API (backend)
  journalTypeLabel: string; // label dropdown / kolom list
  generateType: string; // "" untuk Homestaff & Expat Local
  payrollArea: string;
  businessArea: string;
  salaryType: string;
}

const JOURNAL_TYPE_TRIGGER_ID = "lbl_43fff6_journaltype_213";
const MONTH_TRIGGER_ID = "lbl_43fff6_month_291";
const GENERATE_TYPE_TRIGGER_ID = "lbl_43fff6_generatetype_348";

export class JurnalMemoPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  private async selectOption(trigger: Locator, optionLabel: string): Promise<void> {
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    const option = this.page.getByRole("option", { name: optionLabel, exact: true }).last();
    // Popover dapat langsung tertutup / trigger ikut re-render saat state form
    // berubah (mis. selesainya report validity check). Retry dengan jeda agar
    // re-render settle, dan chunk klik agar tidak terkunci 20s saat tidak stabil.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await trigger.click({ timeout: 5_000 });
      } catch {
        await this.page.waitForTimeout(700);
        continue;
      }
      try {
        await option.waitFor({ state: "visible", timeout: 5_000 });
        await option.click();
        return;
      } catch {
        // Hanya tutup popover bila memang terbuka — Escape tanpa popover akan
        // menutup dialog/modal itu sendiri.
        const contentOpen = this.page.locator('[data-slot="select-content"][data-state="open"]');
        if (await contentOpen.isVisible().catch(() => false)) {
          await this.page.keyboard.press("Escape").catch(() => undefined);
        }
      }
    }
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
  }

  async goto(): Promise<void> {
    await this.page.goto("/jurnal-memo");
    await expect(this.page.getByRole("button", { name: "+ Generate Memo Jurnal" })).toBeVisible({ timeout: 60_000 });
  }

  async generate(data: JurnalMemoCase): Promise<void> {
    await this.page.getByRole("button", { name: "+ Generate Memo Jurnal" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByText("Generate Memo Jurnal")).toBeVisible({ timeout: 30_000 });

    await this.selectOption(this.dialog.locator(`#${JOURNAL_TYPE_TRIGGER_ID}`), data.journalTypeLabel);

    const yearBtn = this.dialog.getByRole("button", { name: /^Year/ });
    await expect(yearBtn).toBeVisible({ timeout: 30_000 });
    if (!(await yearBtn.innerText()).includes(data.year)) {
      await yearBtn.click();
      const contentId = await yearBtn.getAttribute("aria-controls");
      const popover = contentId
        ? this.page.locator(`[id="${contentId}"]`)
        : this.page.locator('[data-slot="popover-content"]');
      await popover.locator("select").selectOption({ label: data.year });
    }

    await this.selectOption(this.dialog.locator(`#${MONTH_TRIGGER_ID}`), MONTH_NAMES_EN[Number(data.month) - 1]);

    if (data.generateType) {
      const gtTrigger = this.dialog.locator(`#${GENERATE_TYPE_TRIGGER_ID}`);
      await expect(gtTrigger).toBeVisible({ timeout: 30_000 });
      await this.selectOption(gtTrigger, data.generateType);
    }

    const payrollInput = this.dialog.getByPlaceholder("Masukkan Payroll Area");
    await expect(payrollInput).toBeVisible({ timeout: 30_000 });
    await payrollInput.fill(data.payrollArea);
    await this.dialog.getByPlaceholder("Masukkan Business Area").fill(data.businessArea);
    await this.dialog.getByPlaceholder("Masukkan Salary Type").fill(data.salaryType);

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/generate-moju/store") && r.request().method() === "POST",
      { timeout: 120_000 },
    );
    await this.dialog.getByRole("button", { name: "Generate", exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST /generate-moju/store -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  async openPeriodList(period: string): Promise<void> {
    await this.page.goto(`/jurnal-memo/list?period=${period}`);
    await expect(this.page.getByText("Detail Jurnal Memo List")).toBeVisible({ timeout: 60_000 });
  }

  async openMemoDetail(data: JurnalMemoCase): Promise<void> {
    const row = this.page.locator("tbody tr").filter({ hasText: data.journalTypeLabel }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.locator("button").first().click();
    await expect(this.page.getByRole("button", { name: "Export Excel" }).first()).toBeVisible({ timeout: 60_000 });
  }

  async review(reason: string): Promise<void> {
    const proceedBtn = this.page.getByRole("button", { name: "Proceed Data" }).first();
    await expect(proceedBtn).toBeVisible({ timeout: 60_000 });
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/generate-moju/reviewed-by-hr/") && r.request().method() === "POST",
      { timeout: 120_000 },
    );
    await proceedBtn.click();
    const modal = this.page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await modal.locator("textarea#reason").fill(reason);
    await modal.getByRole("button", { name: "Approve", exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST /generate-moju/reviewed-by-hr -> ${response.status()}: ${await response.text()}`);
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
