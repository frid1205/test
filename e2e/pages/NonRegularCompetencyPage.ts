import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, clickMonthCell, formField, pickMonth } from "../helpers/ui";

export interface CompetencyCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM
  rate: string | number;
  totalExpected: string | number;
}

const formatUSD = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class NonRegularCompetencyPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/non-regular-salary");
    await this.page.getByRole("tab", { name: "Tunjangan Kompetensi" }).click();
    await expect(this.page.getByRole("button", { name: "+ Add Tunjangan Kompetensi" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Tunjangan Kompetensi" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: CompetencyCase): Promise<void> {
    await chooseCombobox(this.page, this.dialog, this.dialog.getByRole("combobox").first(), data.employee, data.employee);
    await expect(this.field("Band").locator("input")).toHaveValue(/.+/, { timeout: 20_000 });
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, this.field("Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await this.field("Rate").locator("input").fill(String(data.rate));
  }

  async add(data: CompetencyCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submitDialog("Add", "/non-regular-salary-competency/store");
    await this.verifyRow(data);
  }

  async edit(data: CompetencyCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await clickMonthCell(row);
    await expect(this.dialog).toBeVisible();
    await expect(this.field("Rate").locator("input")).toHaveValue(/.+/, { timeout: 30_000 });
    await this.field("Rate").locator("input").fill(String(data.rate));
    await this.submitDialog("Update", "/non-regular-salary-competency/store");
    await this.verifyRow(data);
  }

  async delete(data: CompetencyCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const year = data.period.slice(0, 4);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/non-regular-salary-competency/delete/${year}`) && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE competency -> ${response.status()}: ${await response.text()}`);
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

  private async verifyRow(data: CompetencyCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(formatUSD(Number(data.totalExpected)));
  }
}
