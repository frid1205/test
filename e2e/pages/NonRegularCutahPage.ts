import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, chooseSelect, formField, pickMonth } from "../helpers/ui";

export interface CutahCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM (edit: bulan yang diklik; delete: tahun)
  startPeriod: string; // YYYY-MM (add)
  endPeriod: string; // YYYY-MM (add)
  salary: string | number; // edit
  rate: string | number;
  totalExpected: string | number;
}

const formatUSD = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class NonRegularCutahPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/non-regular-salary");
    await this.page.getByRole("tab", { name: "CUTAH" }).click();
    await expect(this.page.getByRole("button", { name: "+ Add CUTAH" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add CUTAH" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: CutahCase): Promise<void> {
    await chooseCombobox(this.page, this.dialog, this.dialog.getByRole("combobox").first(), data.employee, data.employee);
    await expect(this.field("Band").locator("input")).toHaveValue(/.+/, { timeout: 20_000 });
    const [sYear, sMonth] = data.startPeriod.split("-");
    await pickMonth(this.page, this.field("Start Period").locator("button").first(), MONTH_NAMES_ID[Number(sMonth) - 1], sYear);
    const [eYear, eMonth] = data.endPeriod.split("-");
    await pickMonth(this.page, this.field("End Period").locator("button").first(), MONTH_NAMES_ID[Number(eMonth) - 1], eYear);
    await this.field("Rate").locator("input").fill(String(data.rate));
  }

  async add(data: CutahCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submitDialog("Add", "/non-regular-salary-annual-leave/store");
    await this.verifyRow(data);
  }

  /** Index kolom bulan pada tabel (yearly): Jan-Feb=0, Mar=1, ..., Aug=6, ..., Dec=10. */
  private monthCellIndex(period: string): number {
    const m = Number(period.slice(5, 7));
    return m <= 2 ? 0 : m - 2;
  }

  private async selectYear(year: string): Promise<void> {
    await chooseSelect(this.page, this.page.getByRole("combobox").first(), year);
  }

  private async search(name: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(name);
  }

  async edit(data: CutahCase): Promise<void> {
    await this.selectYear(data.period.slice(0, 4));
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.locator("[role=button][title='Klik untuk edit']").nth(this.monthCellIndex(data.period)).click();
    await expect(this.dialog).toBeVisible();

    // edit via cell: start & end period terkunci, hanya salary & rate yang bisa diubah
    await expect(this.field("Start Period").locator("button").first()).toBeDisabled();
    await expect(this.field("End Period").locator("button").first()).toBeDisabled();
    await expect(this.field("Salary").locator("input")).toHaveValue(/.+/, { timeout: 30_000 });

    await this.field("Salary").locator("input").fill(String(data.salary));
    await this.field("Rate").locator("input").fill(String(data.rate));
    await this.submitDialog("Update", "/non-regular-salary-annual-leave/store");
    await this.verifyRow(data);
  }

  async delete(data: CutahCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const year = data.period.slice(0, 4);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(`/non-regular-salary-annual-leave/delete/${year}`) && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE cutah -> ${response.status()}: ${await response.text()}`);
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

  private async verifyRow(data: CutahCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(formatUSD(Number(data.totalExpected)));
  }
}
