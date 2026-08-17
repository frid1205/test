import { type Locator, type Page, expect } from "@playwright/test";
import { chooseCombobox, chooseSelect, clickRowEdit, moneyFormat, pickDate, pickMonth, submitAndWait } from "../helpers/ui";

export interface OvertimeCase {
  id: string | number;
  action: string;
  employee: string;
  period: string;
  date: string;
  rate: string | number;
  hours: string | number;
  day: string;
  totalExpected: string | number;
}

const DAY_LABEL: Record<string, string> = {
  weekdays: "Weekdays",
  weekends: "Weekends",
  publicHoliday: "Public Holiday",
  nightHour: "Night Hour",
};

export class OvertimePage {
  private readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  // Form Overtime me-reset nilai saat fetch employee-list (getEmployeeList) selesai.
  // Tunggu fetch itu selesai sebelum mengisi, agar isian tidak ter-reset.
  private employeesLoaded(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes("/employee-personal-info/employee-list") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
  }

  private async waitForFormSettled(data: OvertimeCase): Promise<void> {
    const rate = this.dialog.locator("#lbl_d70f4d_overtimerateperhour_342");
    const hours = this.dialog.locator("#lbl_d70f4d_overtimehourpaid_360");
    const day = this.dialog.locator("#lbl_d70f4d_overtimedays_378");
    for (let attempt = 0; attempt < 3; attempt++) {
      await rate.fill(String(data.rate));
      await hours.fill(String(data.hours));
      await chooseSelect(this.page, day, DAY_LABEL[data.day]);
      await this.page.waitForTimeout(500);
      const rateOk = (await rate.inputValue()) === String(data.rate);
      const hoursOk = (await hours.inputValue()) === String(data.hours);
      const dayOk = (await day.innerText()).includes(DAY_LABEL[data.day]);
      if (rateOk && hoursOk && dayOk) return;
    }
    throw new Error("Form edit overtime tidak stabil: isian ter-reset oleh fetch employees");
  }

  async goto(): Promise<void> {
    await this.page.goto("/benefit");
    await this.page.getByRole("tab", { name: "Overtime" }).click();
  }

  async openAdd(): Promise<void> {
    await this.page.getByRole("button", { name: "+ Add Lembur" }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole("combobox").first()).toBeEnabled({ timeout: 60_000 });
  }

  private async fillForm(data: OvertimeCase): Promise<void> {
    const dialog = this.dialog;
    await chooseCombobox(
      this.page,
      dialog,
      dialog.locator("#lbl_d70f4d_employee_279"),
      data.employee,
      data.employee,
    );
    await pickDate(this.page, dialog.locator("#lbl_d70f4d_date_310"), data.date);
    await pickMonth(this.page, dialog.locator("#lbl_d70f4d_paymentperiod_324"), "Agustus", data.period.slice(0, 4));
    await dialog.locator("#lbl_d70f4d_overtimerateperhour_342").fill(String(data.rate));
    await dialog.locator("#lbl_d70f4d_overtimehourpaid_360").fill(String(data.hours));
    await chooseSelect(this.page, dialog.locator("#lbl_d70f4d_overtimedays_378"), DAY_LABEL[data.day]);
  }

  async add(data: OvertimeCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    await this.openAdd();
    await employeesLoaded;
    await this.fillForm(data);
    await submitAndWait(this.page, this.dialog, "Add", "/master-benefit-overtime/store", "Overtime benefit created successfully");
    await this.verifyRow(data);
  }

  async edit(data: OvertimeCase): Promise<void> {
    const employeesLoaded = this.employeesLoaded();
    await clickRowEdit(this.page, data.employee);
    await expect(this.dialog).toBeVisible();
    await employeesLoaded;
    await this.waitForFormSettled(data);
    await submitAndWait(this.page, this.dialog, "Update", "/master-benefit-overtime/store", "Overtime benefit updated successfully");
    await this.verifyRow(data);
  }

  private async verifyRow(data: OvertimeCase): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: data.employee }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText(`$${moneyFormat(data.rate)}`);
    await expect(row).toContainText(String(data.hours));
    await expect(row).toContainText(DAY_LABEL[data.day]);
    await expect(row).toContainText(`$${moneyFormat(data.totalExpected)}`);
  }
}
