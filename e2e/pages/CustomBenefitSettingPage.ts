import { type Locator, type Page, expect } from "@playwright/test";
import { chooseSelect, formField } from "../helpers/ui";

export interface CustomBenefitFieldSpec {
  source: "salary" | "custom";
  label: string;
  type: "Text" | "Number" | "Currency" | "Date";
  defaultValue: string;
  mandatory: boolean;
  showOnTable: boolean;
}

export interface CustomBenefitCase {
  id: string | number;
  action: "add" | "edit";
  title: string;
  editTitle: string;
  sortOrder: string;
  status: "active" | "inactive";
  description: string;
  fields: CustomBenefitFieldSpec[];
  /** Urutan token yang diklik di FormulaBuilder, mis. ["[Salary]", "*", "[Amount]"]. */
  formula: string[];
  editMandatoryField: number;
}

export class CustomBenefitSettingPage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  async goto(): Promise<void> {
    await this.page.goto("/custom-benefit-setting");
    await expect(this.page.getByRole("button", { name: "Add New" })).toBeVisible({ timeout: 60_000 });
  }

  private field(label: string): Locator {
    return formField(this.dialog, label);
  }

  private async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "Add New" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Add Custom Benefit" })).toBeVisible();
  }

  private async fillFieldRow(spec: CustomBenefitFieldSpec): Promise<void> {
    await this.dialog.getByRole("button", { name: "Custom Field", exact: true }).click();
    const li = this.dialog.locator("li").last();
    await expect(li).toBeVisible();

    if (spec.source === "salary") {
      await chooseSelect(this.page, li.locator("[role=combobox]").nth(0), "Salary");
      await expect(li.locator("input").nth(0)).toHaveValue("Salary", { timeout: 20_000 });
    } else {
      await li.locator("input").nth(0).fill(spec.label);
      await chooseSelect(this.page, li.locator("[role=combobox]").nth(1), spec.type);
      if (spec.defaultValue !== "") {
        await li.locator("input").nth(1).fill(spec.defaultValue);
      }
    }

    await li.locator("input[type=checkbox]").nth(0).setChecked(spec.mandatory);
    await li.locator("input[type=checkbox]").nth(1).setChecked(spec.showOnTable);
  }

  private async buildFormula(tokens: string[]): Promise<void> {
    for (const token of tokens) {
      await this.dialog.getByRole("button", { name: token, exact: true }).click();
    }
  }

  private async submit(buttonName: string): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/custom-benefits/store") && r.request().method() === "POST",
      { timeout: 90_000 },
    );
    await this.dialog.getByRole("button", { name: buttonName, exact: true }).click();
    const response = await responsePromise;
    if (!response.ok()) {
      throw new Error(`POST /custom-benefits/store -> ${response.status()}: ${await response.text()}`);
    }
    await expect(this.dialog).toBeHidden({ timeout: 120_000 });
  }

  async add(data: CustomBenefitCase): Promise<void> {
    await this.openAdd();
    await this.field("Title").locator("input").fill(data.title);
    await this.field("Sort Order").locator("input").fill(data.sortOrder);
    await expect(this.dialog.getByText(data.status === "active" ? "ACTIVE" : "INACTIVE")).toBeVisible();
    await this.dialog.locator("textarea").fill(data.description);
    for (const f of data.fields) {
      await this.fillFieldRow(f);
    }
    await this.buildFormula(data.formula);
    await this.submit("Add");
    await this.verifyRow(data.title);
  }

  async edit(data: CustomBenefitCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.title }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("heading", { name: "Edit Custom Benefit" })).toBeVisible();

    // title tetap bisa diubah
    await expect(this.field("Title").locator("input")).toBeEnabled();

    // struktur field terkunci: label/type/default value disabled
    await expect(this.dialog.locator("li").nth(1).locator("input").nth(0)).toBeDisabled();
    await expect(this.dialog.locator("li").nth(1).locator("[role=combobox]").nth(1)).toBeDisabled();
    // formula terkunci
    await expect(this.dialog.getByRole("button", { name: "*", exact: true })).toBeDisabled();

    await this.field("Title").locator("input").fill(data.editTitle);
    await this.dialog.locator("li").nth(data.editMandatoryField).locator("input[type=checkbox]").nth(0).setChecked(true);

    await this.submit("Save");
    await this.verifyRow(data.editTitle);
  }

  private async verifyRow(title: string): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(title);
  }
}
