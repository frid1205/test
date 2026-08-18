import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, currencyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface HomestaffCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM (empty = tanpa period)
  rate: string | number; // reference rate IDR
  mandatory: string | number; // mandatory housing allowance (IDR)
  pension: string | number; // pension fund contribution (IDR)
  dplkEmployer: string | number; // dplk employer contribution (IDR)
  totalExpected: string | number; // total employee deduction (USD, hasil konversi)
  totalEmployerExpected: string | number; // total employer contribution (USD)
  customFields: Record<string, string>; // label custom deduction -> nilai
}

const refRateOption = (rate: string | number): string =>
  `Rp ${Number(rate).toLocaleString("id-ID")}`;

// Label field system deduction (judul custom deduction) yang muncul di form Homestaff.
const HOMESTAFF_FIELD_LABELS = {
  mandatory: "Mandatory Housing Allowance",
  pension: "Pension Fund Contribution",
  dplkEmployer: "DPLK Employer Contribution",
};

export class HomestaffPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  // Form Homestaff mereset isian saat fetch employee-list (getEmployeeListHomestaff)
  // selesai (useEffect [initialData, employees]). Tunggu fetch selesai sebelum mengisi.
  private employeesLoaded(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes("/employee-personal-info/employee-list-homestaff") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
  }

  // Options "Reference Rate" dimuat via /reference-rate saat dialog terbuka.
  private referenceRatesLoaded(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes("/reference-rate") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
  }

  async goto(): Promise<void> {
    await this.page.goto("/homestaff");
    await expect(this.page.getByRole("button", { name: "Add Homestaff" })).toBeVisible({ timeout: 60_000 });
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add Homestaff" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: HomestaffCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_0019c9_employee_428"), data.employee, data.employee, "/employee-personal-info/employee-list-homestaff");
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_0019c9_referencerate_452"), refRateOption(data.rate), refRateOption(data.rate));
    if (data.period) {
      const [year, month] = data.period.split("-");
      await pickMonth(this.page, dialog.locator("#lbl_0019c9_period_467"), MONTH_NAMES_ID[Number(month) - 1], year);
    }
    await dialog.getByLabel(HOMESTAFF_FIELD_LABELS.mandatory).fill(String(data.mandatory));
    await dialog.getByLabel(HOMESTAFF_FIELD_LABELS.pension).fill(String(data.pension));
    await dialog.getByLabel(HOMESTAFF_FIELD_LABELS.dplkEmployer).fill(String(data.dplkEmployer));
    await this.fillCustomFields(data);
  }

  /** Isi custom deduction field berdasarkan label (kolom dinamis dari Excel). */
  private async fillCustomFields(data: HomestaffCase): Promise<void> {
    for (const [label, value] of Object.entries(data.customFields)) {
      if (value === "" || value === undefined) continue;
      await this.dialog.getByLabel(label).fill(String(value));
    }
  }

  async add(data: HomestaffCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    const refsLoaded = this.referenceRatesLoaded();
    await this.openAdd();
    await employeesLoaded;
    await refsLoaded;
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-salary-deduction-homestaff/store", "Homestaff deduction created successfully");
    await this.verifyRow(data);
  }

  async edit(data: HomestaffCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    const refsLoaded = this.referenceRatesLoaded();
    const row = await this.searchRow(data);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    await employeesLoaded;
    await refsLoaded;
    await expect(this.dialog.getByLabel(HOMESTAFF_FIELD_LABELS.mandatory)).toHaveValue(/.+/, { timeout: 30_000 });
    await this.dialog.getByLabel(HOMESTAFF_FIELD_LABELS.mandatory).fill(String(data.mandatory));
    await this.fillCustomFields(data);
    await submitAndWait(this.page, this.dialog, "Update", "/master-salary-deduction-homestaff/store", "Homestaff deduction updated successfully");
    await this.verifyRow(data);
  }

  async delete(data: HomestaffCase, onDeleted?: () => Promise<void>): Promise<void> {
    const row = await this.searchRow(data);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/master-salary-deduction-homestaff/delete/") && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE homestaff -> ${response.status()}: ${await response.text()}`);
    }
    await expect(row).toBeHidden({ timeout: 30_000 });
    await onDeleted?.();
  }

  async filterType(label: string): Promise<void> {
    await this.page.getByRole("button", { name: "Filter" }).click();
    await expect(this.page.locator("#lbl_filter_type")).toBeVisible();
    const trigger = this.page.locator("#lbl_filter_type");
    await trigger.click();
    const option = this.page.getByRole("option", { name: label }).last();
    await expect(option).toBeVisible();
    await option.click();
    await this.page.getByRole("button", { name: "Apply" }).click();
  }

  async resetFilter(): Promise<void> {
    await this.page.getByRole("button", { name: "Filter" }).click();
    await expect(this.page.locator("#lbl_filter_type")).toBeVisible();
    await this.page.getByRole("button", { name: "Reset" }).click();
    await this.page.keyboard.press("Escape");
  }

  /** Klik Filter, pilih bulan+tahun (popover), lalu Apply. Period kosong = reset filter (tampil record tanpa periode).
   * type = label opsi "Type" (mis. "Employer Contribution"); jika diberikan, dipilih juga sebelum Apply. */
  async setPeriodFilter(period: string, type?: string): Promise<void> {
    await this.page.getByRole("button", { name: "Filter" }).click();
    await expect(this.page.locator("#lbl_filter_month")).toBeVisible();
    if (period) {
      const [year, month] = period.split("-");
      await pickMonth(this.page, this.page.locator("#lbl_filter_month"), MONTH_NAMES_ID[Number(month) - 1], year);
    }
    if (type) {
      const trigger = this.page.locator("#lbl_filter_type");
      await trigger.click();
      const option = this.page.getByRole("option", { name: type }).last();
      await expect(option).toBeVisible();
      await option.click();
    }
    if (period || type) {
      await this.page.getByRole("button", { name: "Apply" }).click();
    } else {
      await this.page.getByRole("button", { name: "Reset" }).click();
      await this.page.keyboard.press("Escape");
    }
    await expect(this.page.locator("tbody")).toBeVisible({ timeout: 30_000 });
  }

  private periodLabel(period: string): string {
    return new Date(`${period}-01`).toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  private async searchRow(data: HomestaffCase, type?: string): Promise<Locator> {
    await this.setPeriodFilter(data.period, type);
    const search = this.page.getByPlaceholder("Search...").first();
    await search.fill(data.employee);
    let rows = this.page.locator("tbody tr", { hasText: data.employee });
    if (data.period) {
      rows = rows.filter({ hasText: this.periodLabel(data.period) });
    }
    const row = rows.first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }

  private async verifyRow(data: HomestaffCase): Promise<void> {
    const row = await this.searchRow(data);
    await expect(row).toContainText(`Rp ${Number(data.rate).toLocaleString("en-US")}`);
    await expect(row).toContainText(`$${currencyFormat(data.totalExpected)}`);
    if (data.period) {
      await expect(row).toContainText(this.periodLabel(data.period));
    }
    // Kolom employer contribution hanya tampil di view "Employer Contribution".
    if (Number(data.totalEmployerExpected) > 0) {
      const empRow = await this.searchRow(data, "Employer Contribution");
      await expect(empRow).toContainText(`$${currencyFormat(data.totalEmployerExpected)}`);
    }
  }
}
