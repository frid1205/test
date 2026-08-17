import { type Locator, type Page, expect } from "@playwright/test";
import { chooseCombobox, chooseSelect, clickRowEdit, currencyFormat, submitAndWait } from "../helpers/ui";

export interface RegulerCase {
  id: string | number;
  action: string;
  employee: string;
  category: string;
  basic: string | number;
  position: string | number;
  expat: string | number;
  home: string | number;
  hotskill: string | number;
  totalExpected: string | number;
}

export class RegulerPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/daftar-gaji");
    await expect(this.page.getByText("Daftar Gaji").first()).toBeVisible({ timeout: 30_000 });
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add Daftar Gaji" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: RegulerCase): Promise<void> {
    const dialog = this.dialog;
    const employeeTrigger = dialog.getByRole("combobox").first();
    await chooseCombobox(this.page, dialog, employeeTrigger, data.employee, data.employee);
    await expect(dialog.locator("#band")).not.toHaveValue("", { timeout: 15_000 });

    const categoryTrigger = dialog.locator('[data-slot="select-trigger"]');
    await chooseSelect(this.page, categoryTrigger, data.category);

    await dialog.locator("#basic").fill(String(data.basic));
    await dialog.locator("#position").fill(String(data.position));
    await dialog.locator("#expat").fill(String(data.expat));
    await dialog.locator("#home").fill(String(data.home));
    await dialog.locator("#hotskill").fill(String(data.hotskill));
  }

  async add(data: RegulerCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Save", "/master-reguler-thp/store", "Reguler created successfully");
    await this.verifyRow(data);
  }

  async edit(data: RegulerCase): Promise<void> {
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();

    const dialog = this.dialog;
    await dialog.locator("#basic").fill(String(data.basic));
    await dialog.locator("#position").fill(String(data.position));
    await dialog.locator("#expat").fill(String(data.expat));
    await dialog.locator("#home").fill(String(data.home));
    await dialog.locator("#hotskill").fill(String(data.hotskill));

    await submitAndWait(this.page, this.dialog, "Update", "/master-reguler-thp/store", "Reguler updated successfully");
    await this.verifyRow(data);
  }

  private async verifyRow(data: RegulerCase): Promise<void> {
    // Tabel server-side + paginated (10 baris). Filter via search box agar
    // row target ada di halaman 1 (debounce search 800ms + refetch).
    const search = this.page.getByPlaceholder("Search...").or(this.page.getByPlaceholder(/^Search/).first());
    await search.fill(data.employee);
    await this.page.waitForTimeout(1200);
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(data.category);
    await expect(row).toContainText(`$${currencyFormat(data.basic)}`);
    await expect(row).toContainText(`$${currencyFormat(data.totalExpected)}`);
  }
}
