import { type Locator, type Page, expect } from "@playwright/test";
import { chooseSelect, formField } from "../helpers/ui";

export interface CustomDeductionCase {
  id: string | number;
  action: "add" | "edit";
  title: string;
  editTitle: string;
  calculationType: "Amount" | "Percentage" | "Both";
  appliesHomestaff: boolean;
  appliesExpatLocal: boolean;
  description: string;
  status: "active" | "inactive";
}

export class CustomDeductionSettingPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/custom-deduction-setting");
    await expect(this.page.getByRole("button", { name: "Add New" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  private async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add New" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Add Custom Deduction" })).toBeVisible();
  }

  private async fillForm(data: CustomDeductionCase): Promise<void> {
    await this.field("Title").locator("input").fill(data.title);
    await chooseSelect(this.page, this.dialog.locator("[role=combobox]"), data.calculationType);
    await this.dialog.getByRole("checkbox", { name: "Homestaff" }).setChecked(data.appliesHomestaff);
    await this.dialog.getByRole("checkbox", { name: "Expat Local" }).setChecked(data.appliesExpatLocal);
    await this.dialog.locator("textarea").fill(data.description);
    await expect(this.dialog.getByText(data.status === "active" ? "ACTIVE" : "INACTIVE")).toBeVisible();
  }

  private async submit(buttonName: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/custom-deductions/store") && r.request().method() === "POST",
      { timeout: 90_000 },
    );
    await this.dialog.getByRole("button", { name: buttonName, exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST /custom-deductions/store -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  async add(data: CustomDeductionCase): Promise<void> {
    await this.openAdd();
    await this.fillForm(data);
    await this.submit("Add");
    await this.verifyRow(data.title);
  }

  async edit(data: CustomDeductionCase): Promise<void> {
    await this.search(data.title);
    const row = this.page.locator("tbody tr", { hasText: data.title }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Edit Custom Deduction" })).toBeVisible();
    await this.fillForm({ ...data, title: data.editTitle });
    await this.submit("Save");
    await this.verifyRow(data.editTitle);
  }

  private async search(title: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(title);
  }

  private async verifyRow(title: string): Promise<void> {
    await this.search(title);
    const row = this.page.locator("tbody tr", { hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(title);
  }
}
