import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, chooseSelect, clickRowEdit, pickMonth } from "../helpers/ui";

export interface BfkjCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM
  amount: string | number;
  totalExpected: string | number;
}

const formatUSD = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class NonRegularBfkjPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/non-regular-salary");
    await this.page.getByRole("tab", { name: "BFKJ" }).click();
    await expect(this.page.getByRole("button", { name: "+ Add BFKJ" })).toBeVisible({ timeout: 60_000 });
  }

  /** Wrapper div.space-y-2 dari sebuah field di dialog (berisi span label + kontrol). */
  private field(label: string): Locator {
    return this.dialog.getByText(label, { exact: true }).locator("..");
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add BFKJ" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: BfkjCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.getByRole("combobox").first(), data.employee, data.employee);
    // Status & Band terisi otomatis setelah memilih karyawan (THP + work info).
    await expect(this.field("Band").locator("input")).toHaveValue(/.+/, { timeout: 20_000 });
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, this.field("Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await this.field("Amount").locator("input").fill(String(data.amount));
  }

  async add(data: BfkjCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submitDialog("Submit", "/non-regular-salary-bfkj/store");
    await this.verifyRow(data);
  }

  async edit(data: BfkjCase): Promise<void> {
    await this.setYearFilter(data.period.slice(0, 4));
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await clickRowEdit(this.page, data.employee);
    const monthIdx = Number(data.period.slice(5, 7)) - 1;
    await row.locator("input").nth(monthIdx).fill(String(data.amount));
    await this.submitRow(row, "Submit", "/non-regular-salary-bfkj/bulk-store");
    await this.verifyRow(data);
  }

  /** Filter tahun di tabel (default tahun berjalan). */
  private async setYearFilter(year: string): Promise<void> {
    await chooseSelect(this.page, this.page.getByRole("combobox").first(), year);
  }

  /** Cari berdasarkan nama di kotak Search tabel. */
  private async search(name: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(name);
  }

  async delete(data: BfkjCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const year = data.period.slice(0, 4);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/non-regular-salary-bfkj/delete/${year}`) && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE bfkj -> ${response.status()}: ${await response.text()}`);
    }
    await expect(row).toBeHidden({ timeout: 30_000 });
  }

  private async submitDialog(buttonName: string, apiPath: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(apiPath) && r.request().method() === "POST",
      { timeout: 90_000 },
    );
    await this.dialog.getByRole("button", { name: buttonName, exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST ${apiPath} -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  private async submitRow(row: Locator, buttonName: string, apiPath: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(apiPath) && r.request().method() === "POST",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: buttonName, exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST ${apiPath} -> ${response.status()}: ${await response.text()}`);
    }
    await expect(row.getByRole("button", { name: buttonName })).toBeHidden({ timeout: 30_000 });
  }

  private async verifyRow(data: BfkjCase): Promise<void> {
    await this.setYearFilter(data.period.slice(0, 4));
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(formatUSD(Number(data.totalExpected)));
  }
}