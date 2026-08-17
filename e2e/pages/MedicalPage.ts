import { type Locator, type Page, expect } from "@playwright/test";
import { chooseCombobox, clickRowEdit, moneyFormat, pickMonth, submitAndWait } from "../helpers/ui";

export interface MedicalCase {
  id: string | number;
  action: string;
  employee: string;
  period: string;
  amount: string | number;
  totalExpected: string | number;
}

export class MedicalPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await this.page.getByRole("tab", { name: "Medical" }).click();
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Medical" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: MedicalCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(this.page, dialog, dialog.locator("#lbl_23ed10_employee_210"), data.employee, data.employee);
    await dialog.locator("#lbl_905868_amount_249").fill(String(data.amount));
    await pickMonth(this.page, dialog.locator("#lbl_905868_period_267"), "Agustus", data.period.slice(0, 4));
  }

  async add(data: MedicalCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-all-benefit-and-others/store", "Medical benefit created successfully");
    await this.verifyRow(data);
  }

  async edit(data: MedicalCase): Promise<void> {
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();
    const dialog = this.dialog;
    await dialog.locator("#lbl_905868_amount_249").fill(String(data.amount));
    await submitAndWait(this.page, this.dialog, "Update", "/master-all-benefit-and-others/store", "Medical benefit updated successfully");
    await this.verifyRow(data);
  }

  private async verifyRow(data: MedicalCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(`$${moneyFormat(data.amount)}`);
    await expect(row).toContainText(`$${moneyFormat(data.totalExpected)}`);
  }
}
