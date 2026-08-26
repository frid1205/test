import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, chooseSelect, currencyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface ExpatLocalCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  employee: string;
  period: string; // YYYY-MM (empty = tanpa period)
  rate: string | number; // reference rate IDR
  zakat: string | number;
  employeeDeduction: string | number;
  employeeSeguranca: string | number;
  employee13Seguranca: string | number;
  totalExpected: string | number; // total deduction (USD)
  employerSeguranca: string | number;
  employer13Seguranca: string | number;
  totalEmployerExpected: string | number; // total employer contribution (USD)
  customFields: Record<string, string>; // label custom deduction -> nilai
}

const refRateOption = (rate: string | number): string =>
  `Rp ${Number(rate).toLocaleString("id-ID")}`;

// Label field system deduction (judul custom deduction) yang muncul di form Expat Local.
const EXPAT_FIELD_LABELS = {
  zakat: "Zakat/THR",
  employeeDeduction: "Employee Deduction",
  employeeSeguranca: "Employee Seguranca",
  employee13Seguranca: "Employee 13th Salary Seguranca",
  employerSeguranca: "Employer Contribution Seguranca",
  employer13Seguranca: "Employer Contribution 13th Salary Seguranca",
};

export class ExpatLocalPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  private employeesLoaded(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes("/employee-personal-info/employee-list-expat-local") && r.request().method() === "GET",
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
    await this.page.goto("/expat-local");
    await expect(this.page.getByRole("button", { name: "Add Expat Local" })).toBeVisible({ timeout: 60_000 });
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add Expat Local" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: ExpatLocalCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_2a8007_employee_353"), data.employee, data.employee, "/employee-personal-info/employee-list-expat-local");
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_2a8007_referencerate_393"), refRateOption(data.rate), refRateOption(data.rate));
    if (data.period) {
      const [year, month] = data.period.split("-");
      await pickMonth(this.page, dialog.locator("#lbl_2a8007_period_408"), MONTH_NAMES_ID[Number(month) - 1], year);
    }
    const zakatField = dialog.getByText(EXPAT_FIELD_LABELS.zakat, { exact: true }).locator("..");
    await chooseSelect(this.page, zakatField.locator("[role=combobox]").first(), "Amount");
    await dialog.getByLabel(EXPAT_FIELD_LABELS.zakat).fill(String(data.zakat));
    await dialog.getByLabel(EXPAT_FIELD_LABELS.employeeDeduction).fill(String(data.employeeDeduction));
    await dialog.getByLabel(EXPAT_FIELD_LABELS.employeeSeguranca).fill(String(data.employeeSeguranca));
    await dialog.getByLabel(EXPAT_FIELD_LABELS.employee13Seguranca).fill(String(data.employee13Seguranca));
    await dialog.getByLabel(EXPAT_FIELD_LABELS.employerSeguranca).fill(String(data.employerSeguranca));
    await dialog.getByLabel(EXPAT_FIELD_LABELS.employer13Seguranca).fill(String(data.employer13Seguranca));
    await this.fillCustomFields(data);
  }

  /** Isi custom deduction field berdasarkan label (kolom dinamis dari Excel). */
  private async fillCustomFields(data: ExpatLocalCase): Promise<void> {
    for (const [label, value] of Object.entries(data.customFields)) {
      if (value === "" || value === undefined) continue;
      await this.dialog.getByLabel(label).fill(String(value));
    }
  }

  async add(data: ExpatLocalCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    const refsLoaded = this.referenceRatesLoaded();
    await this.openAdd();
    await employeesLoaded;
    await refsLoaded;
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Save", "/master-salary-deduction-expat-local/store", "Expat Local deduction created successfully");
    await this.verifyRow(data);
  }

  async edit(data: ExpatLocalCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    const refsLoaded = this.referenceRatesLoaded();
    const row = await this.searchRow(data);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    await employeesLoaded;
    await refsLoaded;
    await expect(this.dialog.getByLabel(EXPAT_FIELD_LABELS.employeeDeduction)).toHaveValue(/.+/, { timeout: 30_000 });
    await this.dialog.getByLabel(EXPAT_FIELD_LABELS.employeeDeduction).fill(String(data.employeeDeduction));
    await this.fillCustomFields(data);
    await submitAndWait(this.page, this.dialog, "Save", "/master-salary-deduction-expat-local/store", "Expat Local deduction updated successfully");
    await this.verifyRow(data);
  }

  async delete(data: ExpatLocalCase, onDeleted?: () => Promise<void>): Promise<void> {
    const row = await this.searchRow(data);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/master-salary-deduction-expat-local/delete/") && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE expat-local -> ${response.status()}: ${await response.text()}`);
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

  /**
   * Index kolom diambil dari header, bukan di-hardcode: susunan kolom Expat Local
   * berubah mengikuti filter Type dan jumlah custom deduction yang aktif.
   */
  private async columnIndex(label: string): Promise<number> {
    const headers = (await this.page.locator("thead th").allInnerTexts()).map((h) => h.trim());
    const index = headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
    if (index < 0) {
      throw new Error(`Kolom "${label}" tidak ditemukan. Header saat ini: ${headers.join(" | ")}`);
    }
    return index;
  }

  private async searchRow(data: ExpatLocalCase, type?: string): Promise<Locator> {
    await this.setPeriodFilter(data.period, type);

    const listed = this.page
      .waitForResponse(
        (r) => r.url().includes("/master-salary-deduction-expat-local") && r.request().method() === "GET",
        { timeout: 30_000 },
      )
      .catch(() => undefined);
    const search = this.page.getByPlaceholder("Search...").first();
    await search.fill("");
    await search.fill(data.employee);
    await listed;

    // Record "tanpa period" harus dibedakan dari record ber-period milik karyawan
    // yang sama. Tanpa ini locator cocok ke semua record karyawan tsb dan .first()
    // diam-diam memverifikasi baris yang salah. Kolom Period berisi "-" saat kosong.
    const periodCol = await this.columnIndex("Period");
    const periodCell = this.page.locator(`td:nth-child(${periodCol + 1})`, {
      hasText: data.period ? this.periodLabel(data.period) : /^-$/,
    });
    const rows = this.page
      .locator("tbody tr")
      .filter({ hasText: data.employee })
      .filter({ has: periodCell });

    // Sengaja bukan .first(): kalau masih ada lebih dari satu kandidat (mis. data
    // sisa run sebelumnya), test harus gagal dengan jelas, bukan memilih acak.
    await expect(rows).toHaveCount(1, { timeout: 30_000 });
    return rows.first();
  }

  /** Nilai satu sel pada baris, dipilih lewat nama kolom di header. */
  private async cell(row: Locator, label: string): Promise<Locator> {
    return row.locator("td").nth(await this.columnIndex(label));
  }

  private async verifyRow(data: ExpatLocalCase): Promise<void> {
    // Assert per-sel (toHaveText), bukan toContainText di level <tr>: teks seluruh
    // baris tergabung tanpa pemisah sehingga nilai kolom lain bisa ikut cocok.
    const row = await this.searchRow(data);
    await expect(await this.cell(row, "Reference Rate")).toHaveText(
      `Rp ${Number(data.rate).toLocaleString("en-US")}`,
    );
    await expect(await this.cell(row, "Employee Deduction")).toHaveText(
      `$${currencyFormat(data.employeeDeduction)}`,
    );
    await expect(await this.cell(row, "Total Deduction")).toHaveText(
      `$${currencyFormat(data.totalExpected)}`,
    );
    await expect(await this.cell(row, "Period")).toHaveText(
      data.period ? this.periodLabel(data.period) : "-",
    );

    // Kolom employer contribution hanya tampil di view "Employer Contribution",
    // dan susunan kolomnya berbeda sehingga index diresolusi ulang di sini.
    const empRow = await this.searchRow(data, "Employer Contribution");
    await expect(await this.cell(empRow, "Total Employer Contribution")).toHaveText(
      `$${currencyFormat(data.totalEmployerExpected)}`,
    );
  }
}
