import { test, expect } from "@playwright/test";
import path from "node:path";
import { readAllSheets, type ExcelRow } from "./helpers/excel-reader";
import { LoginPage } from "./pages/LoginPage";
import { RegulerPage, type RegulerCase } from "./pages/RegulerPage";
import { DistrictPage, type DistrictCase } from "./pages/DistrictPage";
import { OvertimePage, type OvertimeCase } from "./pages/OvertimePage";
import { PulsaPage, type PulsaCase } from "./pages/PulsaPage";
import { MedicalPage, type MedicalCase } from "./pages/MedicalPage";
import { OtherProratePage, type OtherProrateCase, type ProrateCase } from "./pages/OtherProratePage";
import { CustomBenefitEntryPage, type BenefitEntryCase } from "./pages/CustomBenefitEntryPage";
import { apiLogin, deleteProrateOthersForEmployee, ensureEmployeeRegulerThp, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";
import { customBenefitTabName } from "./helpers/custom-benefit-data";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");
const CUSTOM_BENEFIT_TAB = customBenefitTabName();

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function toReguler(row: ExcelRow): RegulerCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    category: s(row.category),
    basic: s(row.basic),
    position: s(row.position),
    expat: s(row.expat),
    home: s(row.home),
    hotskill: s(row.hotskill),
    totalExpected: s(row.totalexpected),
  };
}

function toDistrict(row: ExcelRow): DistrictCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    municipio: s(row.municipio),
    period: s(row.period),
    meal: s(row.meal),
    districtAllowance: s(row.districtallowance),
    totalExpected: s(row.totalexpected),
  };
}

const DAY_LABEL_TO_KEY: Record<string, string> = {
  weekdays: "weekdays",
  Weekdays: "weekdays",
  weekends: "weekends",
  Weekends: "weekends",
  "publicHoliday": "publicHoliday",
  "Public Holiday": "publicHoliday",
  nightHour: "nightHour",
  "Night Hour": "nightHour",
};

function toOvertime(row: ExcelRow): OvertimeCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    period: s(row.period),
    date: s(row.date),
    rate: s(row.rate),
    hours: s(row.hours),
    day: DAY_LABEL_TO_KEY[s(row.day)] ?? s(row.day),
    totalExpected: s(row.totalexpected),
  };
}

function toPulsa(row: ExcelRow): PulsaCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    period: s(row.period),
    amount: s(row.amount),
    totalExpected: s(row.totalexpected),
  };
}

function toMedical(row: ExcelRow): MedicalCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    period: s(row.period),
    amount: s(row.amount),
    totalExpected: s(row.totalexpected),
  };
}

function toOtherProrate(row: ExcelRow): OtherProrateCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    period: s(row.period),
    tarif: s(row.tarif),
    rate: s(row.rate),
    payment: s(row.payment),
    remarks: s(row.remarks),
  };
}

function toProrate(row: ExcelRow): ProrateCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    dateOfEntry: s(row.dateofentry),
    period: s(row.period),
    days: s(row.days),
    from80: s(row.from80),
    to80: s(row.to80),
    from100: s(row.from100),
    to100: s(row.to100),
  };
}

function toBenefitEntry(row: ExcelRow): BenefitEntryCase {
  return {
    id: row.id,
    action: s(row.action),
    employee: s(row.employee),
    period: s(row.period),
    salary: s(row.salary),
    amount: s(row.amount),
    date: s(row.date),
    note: s(row.note),
  };
}



const sheets = readAllSheets(DATA_FILE);

test.describe("Login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("Login via UI (Superadmin)", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login("0000000", "PasswordSuperAdmin@Tecel67");
    await expect(page).toHaveURL(/personal-information/);
  });
});

test.describe("Master KKP", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of (sheets.DaftarGaji ?? []).entries()) {
    const c = toReguler(row);
    test(`[Daftar Gaji] ${c.action} - basic ${c.basic} (#${idx + 1})`, async ({ page }) => {
      const p = new RegulerPage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else await p.edit(c);
    });
  }

  for (const [idx, row] of (sheets.District ?? []).entries()) {
    const c = toDistrict(row);
    test(`[Benefit District] ${c.action} - meal ${c.meal} (#${idx + 1})`, async ({ page }) => {
      const p = new DistrictPage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else await p.edit(c);
    });
  }

  for (const [idx, row] of (sheets.Overtime ?? []).entries()) {
    const c = toOvertime(row);
    test(`[Benefit Overtime] ${c.action} - ${c.rate} x ${c.hours}h (#${idx + 1})`, async ({ page }) => {
      const p = new OvertimePage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else await p.edit(c);
    });
  }

  test("[Benefit Overtime] Import - Overtime_Benefit_Template.xlsx", async ({ page }) => {
    const p = new OvertimePage(page);
    await p.goto();
    await p.importOvertime(path.resolve(import.meta.dirname, "data", "Overtime_Benefit_Template.xlsx"));
  });

  for (const [idx, row] of (sheets.Pulsa ?? []).entries()) {
    const c = toPulsa(row);
    test(`[Benefit Pulsa] ${c.action} - amount ${c.amount} (#${idx + 1})`, async ({ page }) => {
      const p = new PulsaPage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else await p.edit(c);
    });
  }

  for (const [idx, row] of (sheets.Medical ?? []).entries()) {
    const c = toMedical(row);
    test(`[Benefit Medical] ${c.action} - amount ${c.amount} (#${idx + 1})`, async ({ page }) => {
      const p = new MedicalPage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else await p.edit(c);
    });
  }

  for (const [idx, row] of (sheets.OtherProrate ?? []).entries()) {
    const c = toOtherProrate(row);
    test(`[Other Prorate] ${c.action} - ${c.payment} (#${idx + 1})`, async ({ page }) => {
      if (c.action.toLowerCase() === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteProrateOthersForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new OtherProratePage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.addOther(c);
      else await p.editOther(c);
    });
  }

  for (const [idx, row] of (sheets.Prorate ?? []).entries()) {
    const c = toProrate(row);
    test(`[Prorate] ${c.action} - ${c.days} days (#${idx + 1})`, async ({ page }) => {
      const p = new OtherProratePage(page);
      await p.goto();
      await p.openTab("Prorate");
      if (c.action.toLowerCase() === "add") await p.addProrate(c);
      else await p.editProrate(c);
    });
  }

  for (const [idx, row] of (sheets["Benefit Others"] ?? []).entries()) {
    const c = toBenefitEntry(row);
    test(`[Benefit Others] ${c.action} - ${c.employee} ${c.period} (#${idx + 1})`, async ({ page }) => {
      if (c.action.toLowerCase() === "add") {
        const { token } = await apiLogin(API_CFG);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new CustomBenefitEntryPage(page);
      await p.goto();
      if (c.action.toLowerCase() === "add") await p.add(c);
      else if (c.action.toLowerCase() === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }

  test(`Tab '${CUSTOM_BENEFIT_TAB}' muncul di Payroll - Master KKP - Benefit`, async ({ page }) => {
    await page.goto("/benefit");
    await expect(page.getByRole("tab", { name: CUSTOM_BENEFIT_TAB })).toBeVisible({ timeout: 60_000 });
  });
});
