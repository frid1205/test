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
import { apiLogin, deleteProrateOthersForEmployee, ensureEmployeeRegulerThp, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");

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

  const otherAdd: OtherProrateCase = {
    id: 1,
    action: "add",
    employee: "RIMBUN SIBURIAN",
    period: "2026-01",
    tarif: 10,
    rate: 2.3,
    payment: "Taxi online claim",
    remarks: "Remark taxi online claim",
  };

  const otherEdit: OtherProrateCase = {
    ...otherAdd,
    id: 2,
    action: "edit",
    rate: 2.5,
    remarks: "Remark taxi online claim updated",
  };

  const prorateAdd: ProrateCase = {
    id: 1,
    action: "add",
    employee: "RIMBUN SIBURIAN",
    dateOfEntry: "2026-01-07",
    period: "2026-01",
    days: 31,
    from80: "2026-01-07",
    to80: "2026-01-14",
    from100: "2026-01-15",
    to100: "2026-01-31",
  };

  const prorateEdit: ProrateCase = {
    ...prorateAdd,
    id: 2,
    action: "edit",
    days: 30,
  };

  test("[Other Prorate] Add - Taxi online claim (Januari 2026)", async ({ page }) => {
    const { token } = await apiLogin(API_CFG);
    await deleteProrateOthersForEmployee(API_CFG, token, "RIMBUN SIBURIAN");
    await ensureEmployeeRegulerThp(API_CFG, token, "RIMBUN SIBURIAN");
    const p = new OtherProratePage(page);
    await p.goto();
    await p.addOther(otherAdd);
  });

  test("[Other Prorate] Edit - rate 2.5", async ({ page }) => {
    const p = new OtherProratePage(page);
    await p.goto();
    await p.editOther(otherEdit);
  });

  test("[Prorate] Add - Januari 2026 (31 hari)", async ({ page }) => {
    const p = new OtherProratePage(page);
    await p.goto();
    await p.openTab("Prorate");
    await p.addProrate(prorateAdd);
  });

  test("[Prorate] Edit - number of days 30", async ({ page }) => {
    const p = new OtherProratePage(page);
    await p.goto();
    await p.openTab("Prorate");
    await p.editProrate(prorateEdit);
  });
});
