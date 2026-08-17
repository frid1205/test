import { type Locator, type Page, expect } from "@playwright/test";
import { MONTH_NAMES_ID, chooseCombobox, pickMonth, submitAndWait } from "../helpers/ui";

export interface DeductionTransferCase {
  id: string | number;
  action: "add" | "edit" | "delete";
  period: string; // YYYY-MM
  deductionType: string;
  transferTo: string; // account_holder_name (value combobox "Transfer To")
  transferToLabel: string; // label opsi penuh, mis. "[Company] PT AZKO - Mandiri"
  bankName: string; // auto-filled
  accountNumber: string; // auto-filled
  amount: string | number; // tidak diverifikasi (ditetapkan server)
}

export class DeductionTransferPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  // Form memuat daftar bank via /master-bank/list saat dialog terbuka (useBanks).
  private banksLoaded(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes("/master-bank/list") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
  }

  async goto(): Promise<void> {
    await this.page.goto("/deduction-transfer");
    await expect(this.page.getByRole("button", { name: "+ Add Data" })).toBeVisible({ timeout: 60_000 });
  }

  private async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Data" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Add Deduction Transfer" })).toBeVisible({ timeout: 30_000 });
  }

  private async fillForm(data: DeductionTransferCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(
      this.page,
      dialog,
      dialog.locator("#lbl_6d4c51_deduction_type_289"),
      data.deductionType,
      data.deductionType,
    );
    await chooseCombobox(
      this.page,
      dialog,
      dialog.locator("#lbl_6d4c51_transfer_to_323"),
      data.transferTo,
      data.transferToLabel,
    );
    const [year, month] = data.period.split("-");
    await pickMonth(this.page, dialog.locator("#lbl_6d4c51_transfer_date_404"), MONTH_NAMES_ID[Number(month) - 1], year);
    // Bank & No. Rek terisi otomatis setelah "Transfer To" dipilih.
    await expect(dialog.locator("#lbl_6d4c51_bank_362")).toHaveValue(data.bankName);
    await expect(dialog.locator("#lbl_6d4c51_account_number_384")).toHaveValue(data.accountNumber);
  }

  async add(data: DeductionTransferCase): Promise<void> {
    const banksLoaded = this.banksLoaded();
    await this.openAdd();
    await banksLoaded;
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/deduction-transfer/store", "Deduction Transfer added successfully");
    await this.verifyRow(data);
  }

  async edit(data: DeductionTransferCase): Promise<void> {
    const banksLoaded = this.banksLoaded();
    const row = await this.searchRow(data);
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Edit Deduction Transfer" })).toBeVisible({ timeout: 30_000 });
    await banksLoaded;
    // Bentuk edit menyinkronkan isian dari initialData + bank setelah bank dimuat.
    await expect(this.dialog.locator("#lbl_6d4c51_bank_362")).toHaveValue(data.bankName, { timeout: 30_000 });
    await chooseCombobox(
      this.page,
      this.dialog,
      this.dialog.locator("#lbl_6d4c51_deduction_type_289"),
      data.deductionType,
      data.deductionType,
    );
    await submitAndWait(this.page, this.dialog, "Update", "/deduction-transfer/store", "Deduction Transfer updated successfully");
    await this.verifyRow(data);
  }

  async delete(data: DeductionTransferCase, onDeleted?: () => Promise<void>): Promise<void> {
    const row = await this.searchRow(data);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/deduction-transfer/delete/") && r.request().method() === "DELETE",
      { timeout: 90_000 },
    );
    await row.getByRole("button", { name: "Delete" }).click();
    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText("Confirm Delete")).toBeVisible();
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`DELETE deduction-transfer -> ${response.status()}: ${await response.text()}`);
    }
    await expect(row).toBeHidden({ timeout: 30_000 });
    await onDeleted?.();
  }

  // Filter periode DatePicker ada di baris flex yg memuat box "Search...". Button-nya
  // berlabel placeholder ("Filter by Period") ATAU bulan terpilih ("Agustus 2026"),
  // jadi cari via induk baris filter; skip bila sudah sesuai target.
  private async setPeriodFilter(period: string): Promise<void> {
    const [year, month] = period.split("-");
    const label = `${MONTH_NAMES_ID[Number(month) - 1]} ${year}`;
    const filterRow = this.page
      .locator("div.flex.gap-2.items-center")
      .filter({ has: this.page.getByPlaceholder("Search...") })
      .first();
    const trigger = filterRow.getByRole("button").first();
    if ((await trigger.innerText()).trim() !== label) {
      await pickMonth(this.page, trigger, MONTH_NAMES_ID[Number(month) - 1], year);
    }
    await expect(this.page.locator("tbody")).toBeVisible({ timeout: 30_000 });
  }

  private async searchRow(data: DeductionTransferCase): Promise<Locator> {
    await this.setPeriodFilter(data.period);
    const search = this.page.getByPlaceholder("Search...").first();
    await search.fill(data.transferTo);
    const rows = this.page.locator("tbody tr", { hasText: data.transferTo });
    const row = rows.filter({ hasText: data.period }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    return row;
  }

  private async verifyRow(data: DeductionTransferCase): Promise<void> {
    const row = await this.searchRow(data);
    await expect(row).toContainText(data.period);
    await expect(row).toContainText(data.deductionType);
    await expect(row).toContainText(data.transferTo);
    await expect(row).toContainText(data.bankName);
    await expect(row).toContainText(data.accountNumber);
    // amount ditetapkan server (form tak punya field amount), jadi hanya pastikan
    // sel Jumlah/Jumlah Transfer menampilkan nilai format "$ x,xx".
    await expect(row.locator("td").nth(3)).toContainText("$ ");
  }
}