import { type Locator, type Page, expect } from "@playwright/test";
import { chooseCombobox, clickRowEdit, moneyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface PulsaCase {
  id: string | number;
  action: string;
  employee: string;
  period: string;
  amount: string | number;
  totalExpected: string | number;
}

export class PulsaPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await this.page.getByRole("tab", { name: "Pulsa" }).click();
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Pulsa" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: PulsaCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.getByRole("combobox").first(), data.employee, data.employee);
    await dialog.locator("#lbl_be7cad_amount_203").fill(String(data.amount));
    await pickMonth(this.page, dialog.locator("#lbl_be7cad_period_221"), "Agustus", data.period.slice(0, 4));
  }

  async add(data: PulsaCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-all-benefit-and-others/store", "Pulsa benefit created successfully");
    await this.verifyRow(data);
  }

  async edit(data: PulsaCase): Promise<void> {
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_be7cad_amount_203").fill(String(data.amount));
    await submitAndWait(this.page, this.dialog, "Update", "/master-all-benefit-and-others/store", "Pulsa benefit updated successfully");
    await this.verifyRow(data);
  }

  private async verifyRow(data: PulsaCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(`$${moneyFormat(data.amount)}`);
    await expect(row).toContainText(`$${moneyFormat(data.totalExpected)}`);
  }
}
