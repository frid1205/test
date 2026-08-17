import { type Locator, type Page, expect } from "@playwright/test";
import {
  MONTH_NAMES_ID,
  chooseCombobox,
  clickRowEdit,
  pickDay,
  pickMonth,
  pickRange,
  submitAndWait,
} from "../helpers/ui";

export interface OtherProrateCase {
  id: string | number;
  action: string;
  employee: string;
  period: string;
  tarif: string | number;
  rate: string | number;
  payment: string;
  remarks: string;
}

export interface ProrateCase {
  id: string | number;
  action: string;
  employee: string;
  dateOfEntry: string;
  period: string;
  days: string | number;
  from80: string;
  to80: string;
  from100: string;
  to100: string;
}

const formatUSD = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export class OtherProratePage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/other-&-prorate");
    await expect(this.page.getByRole("tab", { name: "Other" })).toBeVisible({ timeout: 60_000 });
  }

  async openTab(tab: "Other" | "Prorate"): Promise<void> {
    await this.page.getByRole("tab", { name: tab }).click();
    await expect(this.page.getByRole("button", { name: /^\+ Add (Other|Prorate)$/ })).toBeVisible({ timeout: 60_000 });
  }

  /** Tombol filter periode tabel menampilkan bulan saat ini ("Agustus 2026"). */
  async setPeriodFilter(yearMonth: string): Promise<void> {
    const [year, month] = yearMonth.split("-");
    const current = new Date();
    const label = `${MONTH_NAMES_ID[current.getMonth()]} ${current.getFullYear()}`;
    const trigger = this.page.getByRole("button", { name: new RegExp(`^${label}$`) }).first();
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await pickMonth(this.page, trigger, MONTH_NAMES_ID[Number(month) - 1], year);
    await this.page.waitForTimeout(500);
  }

  // ─── Other ────────────────────────────────────────────────────────────────

  private async openAddOther(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Other" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillOtherForm(data: OtherProrateCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_48eb05_employee_306"), data.employee, data.employee);
    await pickMonth(this.page, dialog.locator("#lbl_48eb05_period_381"), MONTH_NAMES_ID[Number(data.period.slice(5, 7)) - 1], data.period.slice(0, 4));
    await dialog.locator("#lbl_48eb05_tarif_396").fill(String(data.tarif));
    await dialog.locator("#lbl_48eb05_rate_420").fill(String(data.rate));
    await dialog.locator("#lbl_48eb05_payment_434").fill(data.payment);
    await dialog.locator("#lbl_48eb05_remarks_451").fill(data.remarks);
  }

  async addOther(data: OtherProrateCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    await this.openAddOther();
    await this.fillOtherForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-prorate-others/store", "");
    await this.verifyOtherRow(data);
  }

  async editOther(data: OtherProrateCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_48eb05_rate_420").fill(String(data.rate));
    await dialog.locator("#lbl_48eb05_remarks_451").fill(data.remarks);
    await submitAndWait(this.page, this.dialog, "Update", "/master-prorate-others/store", "");
    await this.verifyOtherRow(data);
  }

  private async verifyOtherRow(data: OtherProrateCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(data.payment);
    await expect(row).toContainText(formatUSD(Number(data.tarif)));
    await expect(row).toContainText(formatUSD(Number(data.rate)));
    await expect(row).toContainText(formatUSD(Number(data.tarif) * Number(data.rate)));
  }

  // ─── Prorate ──────────────────────────────────────────────────────────────

  private async openAddProrate(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Prorate" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillProrateForm(data: ProrateCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_757579_employee_376"), data.employee, data.employee);
    await expect(dialog.locator("#lbl_757579_position_403")).toHaveValue(/.+/, { timeout: 30_000 });
    await pickDay(this.page, dialog.locator("#lbl_757579_dateofentry_417"), data.dateOfEntry);
    await pickMonth(this.page, dialog.locator("#lbl_757579_paymentperiod_434"), MONTH_NAMES_ID[Number(data.period.slice(5, 7)) - 1], data.period.slice(0, 4));
    await dialog.locator("#lbl_757579_numberofdays_448").fill(String(data.days));
    // Tombol range dicari lewat wrapper label-nya: teks tombol 100% berubah
    // menjadi tanggal after auto-set dari range 80%.
    const range80 = dialog.locator("div").filter({ hasText: "Period 80% Prorate" }).last().getByRole("button").first();
    const range100 = dialog.locator("div").filter({ hasText: "Period 100% Prorate" }).last().getByRole("button").first();
    await pickRange(this.page, range80, data.from80, data.to80);
    await pickRange(this.page, range100, data.from100, data.to100);
  }

  async addProrate(data: ProrateCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    await this.openAddProrate();
    await this.fillProrateForm(data);
    await submitAndWait(this.page, this.dialog, "Save", "/master-prorate/store", "");
    await this.verifyProrateRow(data);
  }

  async editProrate(data: ProrateCase): Promise<void> {
    await this.setPeriodFilter(data.period);
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_757579_numberofdays_448").fill(String(data.days));
    await submitAndWait(this.page, this.dialog, "Save", "/master-prorate/store", "");
    await this.verifyProrateRow(data);
  }

  private async verifyProrateRow(data: ProrateCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    const [year, month] = data.period.split("-");
    const periodLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "short" });
    await expect(row).toContainText(periodLabel);
    await expect(row).toContainText(String(data.days));
    const fmt = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };
    await expect(row).toContainText(`${fmt(data.from80)} - ${fmt(data.to80)}`);
    await expect(row).toContainText(`${fmt(data.from100)} - ${fmt(data.to100)}`);
  }
}
