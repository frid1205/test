import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, formField, pickDate, pickMonth } from "../helpers/ui";

export interface BenefitEntryCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM
  salary: string | number;
  amount: string | number;
  date: string; // YYYY-MM-DD
  note: string;
}

const formatIdr = (v: string | number) => Number(v).toLocaleString("id-ID");

export class CustomBenefitEntryPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await this.page.getByRole("tab", { name: "Benefit Others" }).click();
    await expect(this.page.getByRole("button", { name: /Add Data/ })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  /** Filter periode tabel (default bulan berjalan) agar entry periode target terlihat. */
  private async setPeriodFilter(yearMonth: string): Promise<void> {
    const [year, month] = yearMonth.split("-");
    const trigger = this.page.getByRole("button", { name: new RegExp(`^(${MONTH_NAMES_ID.join("|")}) \\d{4}$`) }).first();
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await pickMonth(this.page, trigger, MONTH_NAMES_ID[Number(month) - 1], year);
    await this.page.waitForTimeout(500);
  }

  private async search(name: string): Promise<void> {
    await this.page.getByPlaceholder("Search NIK, name, position...").fill(name);
  }

  private async searchRow(name: string): Promise<Locator> {
    await this.search(name);
    const row = this.page.locator("tbody tr", { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }

  private async fillForm(data: BenefitEntryCase): Promise<void> {
    await chooseCombobox(
      this.page,
      this.dialog,
      this.dialog.getByRole("combobox").first(),
      data.employee,
      data.employee,
      "/employee-personal-info/employee-list",
    );
    await expect(this.field("Salary").locator("input")).toHaveValue(/500/, { timeout: 30_000 });
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, this.field("Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await this.field("Amount").locator("input").fill(String(data.amount));
    await pickDate(this.page, this.field("Date").locator("button").first(), data.date);
    await this.field("Note").locator("input").fill(data.note);
  }

  private async submit(buttonName: string): Promise<void> {
    await this.dialog.getByRole("button", { name: buttonName, exact: true }).click();
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  async add(data: BenefitEntryCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    await this.page.getByRole("button", { name: /Add Data/ }).click();
    await expect(this.dialog).toBeVisible();
    await this.fillForm(data);
    await this.submit("Save");
    await this.verifyRow(data);
  }

  async edit(data: BenefitEntryCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    const row = await this.searchRow(data.employee);
    await row.locator("button").filter({ has: this.page.locator(".lucide-pencil") }).click();
    await expect(this.dialog).toBeVisible();
    const amount = this.field("Amount").locator("input");
    await expect(amount).toHaveValue(/.+/, { timeout: 30_000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await amount.fill(String(data.amount));
      await this.page.waitForTimeout(500);
      if ((await amount.inputValue()) === String(data.amount)) break;
    }
    await this.submit("Update");
    await this.verifyRow(data);
  }

  async delete(data: BenefitEntryCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    const row = await this.searchRow(data.employee);
    await row.locator("button").filter({ has: this.page.locator(".lucide-trash-2") }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    await expect(row).toBeHidden({ timeout: 30_000 });
  }

  private async verifyRow(data: BenefitEntryCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    const row = await this.searchRow(data.employee);
    await expect(row).toContainText(formatIdr(data.amount));
    await expect(row).toContainText(data.note);
  }
}
