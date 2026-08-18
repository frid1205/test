import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, currencyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface DistrictCase {
  id: string | number;
  action: string;
  employee: string;
  municipio: string;
  period: string;
  meal: string | number;
  districtAllowance: string | number;
  totalExpected: string | number;
}

export class DistrictPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await expect(this.page.getByRole("tab", { name: "District" })).toBeVisible({ timeout: 30_000 });
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add District" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: DistrictCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(
      this.page,
      dialog,
      dialog.locator("#lbl_d31214_employee_316"),
      data.employee,
      data.employee,
    );
    await chooseCombobox(
      this.page,
      dialog,
      dialog.locator("#lbl_d31214_municipio_345"),
      data.municipio,
      data.municipio,
    );
    await pickMonth(this.page, dialog.locator("#lbl_d31214_period_374"), MONTH_NAMES_ID[Number(data.period.slice(5, 7)) - 1], data.period.slice(0, 4));
    await dialog.locator("#lbl_d31214_meal_403").fill(String(data.meal));
    await dialog.locator("#lbl_d31214_districtallowance_417").fill(String(data.districtAllowance));
  }

  async add(data: DistrictCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-benefit-district/store", "District benefit created successfully");
    await this.verifyRow(data);
  }

  async edit(data: DistrictCase): Promise<void> {
    const row = await this.findRow(data);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_d31214_meal_403").fill(String(data.meal));
    await dialog.locator("#lbl_d31214_districtallowance_417").fill(String(data.districtAllowance));
    await submitAndWait(this.page, this.dialog, "Update", "/master-benefit-district/store", "District benefit updated successfully");
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

  /** Cari berdasarkan nama di kotak Search tabel. */
  private async search(name: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(name);
  }

  /** Filter tahun+bulan lalu cari nama, kembalikan baris target. */
  private async findRow(data: DistrictCase): Promise<Locator> {
    await this.setPeriodFilter(data.period);
    await this.search(data.employee);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }

  private async verifyRow(data: DistrictCase): Promise<void> {
    const row = await this.findRow(data);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(data.municipio);
    await expect(row).toContainText(data.period);
    await expect(row).toContainText(`$${currencyFormat(data.meal)}`);
    await expect(row).toContainText(`$${currencyFormat(data.districtAllowance)}`);
    await expect(row).toContainText(`$${currencyFormat(data.totalExpected)}`);
  }
}
