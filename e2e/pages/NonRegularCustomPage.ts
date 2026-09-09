import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, clickMonthCell, formField, pickMonth } from "../helpers/ui";

export interface CustomCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM
  rate: string | number;
  amount: string | number;
  keterangan: string | number;
  totalExpected: string | number;
}

/** Format id-ID: `$ 1.500` */
const formatIdr = (v: number) => "$ " + v.toLocaleString("id-ID");

const MONTH_HEADERS = ["Jan", "Feb", "Mar", "Apr", "Mei|May", "Jun", "Jul", "Agu|Aug", "Sep", "Okt|Oct", "Nov", "Des|Dec"];

export class NonRegularCustomPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/non-regular-salary");
    await this.page.getByRole("tab", { name: "tunjangan jabatan 2" }).click();
    await expect(this.page.getByRole("button", { name: "Add tunjangan" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add tunjangan" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: CustomCase): Promise<void> {
    await chooseCombobox(this.page, this.dialog, this.dialog.getByRole("combobox").first(), data.employee, data.employee);
    await expect(this.field("Band").locator("input")).toHaveValue(/.+/, { timeout: 20_000 });
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, this.field("Start Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await pickMonth(this.page, this.field("End Period").locator("button").first(), MONTH_NAMES_ID[Number(month) - 1], year);
    await this.field("rate").locator("input").fill(String(data.rate));
    await this.field("amount").locator("input").fill(String(data.amount));
    if (data.keterangan !== "" && data.keterangan !== undefined) {
      await this.field("keterangan").locator("input").fill(String(data.keterangan));
    }
  }

  async add(data: CustomCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submitDialog("Add tunjangan", "/salary-components/store-calculation-data/");
    await this.verifyRow(data);
  }

  async edit(data: CustomCase): Promise<void> {
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    // loadDetails (async) menimpa field dari detail record setelah modal terbuka;
    // tunggu respons selesai agar isi form tidak ditimpa lagi setelah fill.
    const detailPromise = this.page.waitForResponse(
      (r) => r.url().includes("/salary-components/calculation-data-detail/") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
    await this.clickMonthCellByPeriod(row, data.period);
    await expect(this.dialog).toBeVisible();
    await detailPromise;
    await expect(this.field("amount").locator("input")).toHaveValue(/[0-9]/, { timeout: 30_000 });
    await this.field("amount").locator("input").fill(String(data.amount));
    await this.submitDialog("Update Record", "/salary-components/update-calculation-data/", "PUT");
    await this.verifyRow(data);
  }

  private async clickMonthCellByPeriod(row: Locator, period: string): Promise<void> {
    const month = Number(period.slice(5, 7));
    const label = MONTH_HEADERS[month - 1];
    const header = this.page.getByRole("columnheader", { name: new RegExp(`^(${label})$`, "i") }).first();
    await expect(header).toBeVisible({ timeout: 30_000 });
    const columnIndex = await header.evaluate((el) =>
      Array.prototype.indexOf.call(el.parentElement?.children, el),
    );
    await row.locator("td").nth(columnIndex).locator("[role=button]").click();
  }

  async delete(data: CustomCase): Promise<void> {
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/salary-components/delete-calculation-data/") && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.locator("button").filter({ has: this.page.locator(".lucide-trash-2") }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE custom -> ${response.status()}: ${await response.text()}`);
    }
    await expect(row).toBeHidden({ timeout: 30_000 });
  }

  private async submitDialog(buttonName: string, apiPath: string, method: "POST" | "PUT" = "POST"): Promise<void> {
    const basePath = apiPath.replace(/\/(store-calculation-data|update-calculation-data|delete-calculation-data)$/, "");
    const responsePromise = this.page.waitForResponse(
      (r) =>
        r.url().includes("/salary-components/") &&
        ["POST", "PUT", "PATCH"].includes(r.request().method()),
      { timeout: 90_000 },
    );
    const button = this.dialog
      .getByRole("button", { name: new RegExp(`^(${buttonName}|Save|Update|Submit|Add)$`, "i") })
      .first();
    await button.click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`${method} ${apiPath} -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  private async search(name: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder("Search employee...").or(this.page.getByPlaceholder("Search..."));
    await searchInput.fill(name);
  }

  private async verifyRow(data: CustomCase): Promise<void> {
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(formatIdr(Number(data.totalExpected)));
  }
}
