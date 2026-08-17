import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, clickRowEdit, formField, pickMonth } from "../helpers/ui";

export interface HometripCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM
  amount: string | number;
  totalExpected: string | number;
}

const formatUSD = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class NonRegularHometripPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/non-regular-salary");
    await this.page.getByRole("tab", { name: "Hometrip" }).click();
    await expect(this.page.getByRole("button", { name: "+ Add Hometrip" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Hometrip" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: HometripCase): Promise<void> {
    await chooseCombobox(this.page, this.dialog, this.dialog.getByRole("combobox").first(), data.employee, data.employee);
    await expect(this.field("Band").locator("input")).toHaveValue(/.+/, { timeout: 20_000 });
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, this.field("Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await this.field("Amount").locator("input").fill(String(data.amount));
  }

  async add(data: HometripCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submitDialog("Submit", "/non-regular-salary-hometrip/store");
    await this.verifyRow(data);
  }

  async edit(data: HometripCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await clickRowEdit(this.page, data.employee);
    const monthIdx = Number(data.period.slice(5, 7)) - 1;
    await row.locator("input").nth(monthIdx).fill(String(data.amount));
    await this.submitRow(row, "Submit", "/non-regular-salary-hometrip/store");
    await this.verifyRow(data);
  }

  async delete(data: HometripCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const year = data.period.slice(0, 4);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/non-regular-salary-hometrip/delete/${year}`) && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE hometrip -> ${response.status()}: ${await response.text()}`);
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

  private async verifyRow(data: HometripCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(formatUSD(Number(data.totalExpected)));
  }
}
