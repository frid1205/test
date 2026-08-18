import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, moneyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface MedicalCase {
  id: string | number;
  action: string;
  employee: string;
  period: string;
  amount: string | number;
  totalExpected: string | number;
}

export class MedicalPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await this.page.getByRole("tab", { name: "Medical" }).click();
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Medical" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: MedicalCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_23ed10_employee_210"), data.employee, data.employee);
    await dialog.locator("#lbl_905868_amount_249").fill(String(data.amount));
    await pickMonth(this.page, dialog.locator("#lbl_905868_period_267"), MONTH_NAMES_ID[Number(data.period.slice(5, 7)) - 1], data.period.slice(0, 4));
  }

  async add(data: MedicalCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-all-benefit-and-others/store", "Medical benefit created successfully");
    await this.verifyRow(data);
  }

  async edit(data: MedicalCase): Promise<void> {
    const row = await this.findRow(data);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_905868_amount_249").fill(String(data.amount));
    await submitAndWait(this.page, this.dialog, "Update", "/master-all-benefit-and-others/store", "Medical benefit updated successfully");
    await this.verifyRow(data);
  }

  /** Filter periode tabel (default bulan berjalan) agar baris periode target terlihat. */
  private async setPeriodFilter(yearMonth: string): Promise<void> {
    const [year, month] = yearMonth.split("-");
    const trigger = this.page.getByRole("button", { name: new RegExp(`^(${MONTH_NAMES_ID.join("|")}) \\d{4}$`) }).first();
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await pickMonth(this.page, trigger, MONTH_NAMES_ID[Number(month) - 1], year);
    await this.page.waitForTimeout(500);
  }

  /** Filter tahun+bulan lalu cari nama, kembalikan baris target. */
  private async findRow(data: MedicalCase): Promise<Locator> {
    await this.setPeriodFilter(data.period);
    await this.page.getByPlaceholder("Search...").fill(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }

  private async verifyRow(data: MedicalCase): Promise<void> {
    const row = await this.findRow(data);
    await expect(row).toContainText(`$${moneyFormat(data.amount)}`);
    await expect(row).toContainText(`$${moneyFormat(data.totalExpected)}`);
  }
}
