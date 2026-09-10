import { test } from "@playwright/test";
import path from "node:path";
import { readSheet, type ExcelRow } from "./helpers/excel-reader";
import { NonRegularBfkjPage, type BfkjCase } from "./pages/NonRegularBfkjPage";
import { NonRegularHometripPage, type HometripCase } from "./pages/NonRegularHometripPage";
import { NonRegularCutahPage, type CutahCase } from "./pages/NonRegularCutahPage";
import { NonRegularGaji13Page, type Gaji13Case } from "./pages/NonRegularGaji13Page";
import { NonRegularCompetencyPage, type CompetencyCase } from "./pages/NonRegularCompetencyPage";
import { NonRegularCustomPage, type CustomCase } from "./pages/NonRegularCustomPage";
import {
  apiLogin,
  deleteAnnualLeaveForEmployee,
  deleteBfkjForEmployee,
  deleteCompetencyForEmployee,
  deleteCustomForEmployee,
  deleteHometripForEmployee,
  deleteMonthSalaryForEmployee,
  ensureEmployeeRegulerThp,
  type PayrollApiConfig,
} from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-nonregular.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function toBfkj(row: ExcelRow): BfkjCase {
  return {
    id: row.id,
    action: s(row.action) as BfkjCase["action"],
    employee: s(row.employee),
    period: s(row.period),
    amount: s(row.amount),
    totalExpected: s(row.totalexpected),
  };
}

const CUSTOM_COMPONENT_UUID = "ff8914ee-db51-4233-ad1f-4783bab17175";

const bfkjRows = readSheet(DATA_FILE, "Bfkj");
const hometripRows = readSheet(DATA_FILE, "Hometrip");
const cutahRows = readSheet(DATA_FILE, "Cutah");
const gaji13Rows = readSheet(DATA_FILE, "GajiKe13");
const competencyRows = readSheet(DATA_FILE, "TunjanganKompetensi");
const customRows = readSheet(DATA_FILE, "TunjanganJabatan2");

test.describe("Non Regular - BFKJ", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of bfkjRows.entries()) {
    const c = toBfkj(row);
    test(`[BFKJ] ${c.action} - ${c.employee} ${c.period} amount ${c.amount || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteBfkjForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularBfkjPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});

test.describe("Non Regular - Hometrip", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of hometripRows.entries()) {
    const c = toBfkj(row) as HometripCase;
    test(`[Hometrip] ${c.action} - ${c.employee} ${c.period} amount ${c.amount || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteHometripForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularHometripPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});

function toCutah(row: ExcelRow): CutahCase {
  return {
    id: row.id,
    action: s(row.action) as CutahCase["action"],
    employee: s(row.employee),
    period: s(row.period),
    startPeriod: s(row.startperiod),
    endPeriod: s(row.endperiod),
    salary: s(row.salary),
    rate: s(row.rate),
    totalExpected: s(row.totalexpected),
  };
}

test.describe("Non Regular - CUTAH", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of cutahRows.entries()) {
    const c = toCutah(row);
    test(`[CUTAH] ${c.action} - ${c.employee} ${c.period} rate ${c.rate || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteAnnualLeaveForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularCutahPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});

function toGaji13(row: ExcelRow): Gaji13Case {
  return {
    id: row.id,
    action: s(row.action) as Gaji13Case["action"],
    employee: s(row.employee),
    period: s(row.period),
    basic: s(row.basic),
    position: s(row.position),
    expat: s(row.expat),
    homestaff: s(row.homestaff),
    hotskill: s(row.hotskill),
    totalExpected: s(row.totalexpected),
  };
}

test.describe("Non Regular - Gaji Ke-13", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of gaji13Rows.entries()) {
    const c = toGaji13(row);
    test(`[GajiKe13] ${c.action} - ${c.employee} ${c.period} total ${c.totalExpected || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteMonthSalaryForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularGaji13Page(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});

function toCompetency(row: ExcelRow): CompetencyCase {
  return {
    id: row.id,
    action: s(row.action) as CompetencyCase["action"],
    employee: s(row.employee),
    period: s(row.period),
    rate: s(row.rate),
    totalExpected: s(row.totalexpected),
  };
}

test.describe("Non Regular - Tunjangan Kompetensi", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of competencyRows.entries()) {
    const c = toCompetency(row);
    test(`[Kompetensi] ${c.action} - ${c.employee} ${c.period} rate ${c.rate || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteCompetencyForEmployee(API_CFG, token, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularCompetencyPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});

function toCustom(row: ExcelRow): CustomCase {
  return {
    id: row.id,
    action: s(row.action) as CustomCase["action"],
    employee: s(row.employee),
    period: s(row.period),
    rate: s(row.rate),
    amount: s(row.amount),
    keterangan: s(row.keterangan),
    totalExpected: s(row.totalexpected),
  };
}

test.describe("Non Regular - Custom (tunjangan jabatan 2)", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of customRows.entries()) {
    const c = toCustom(row);
    test(`[Custom] ${c.action} - ${c.employee} ${c.period} total ${c.totalExpected || "-"} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteCustomForEmployee(API_CFG, token, CUSTOM_COMPONENT_UUID, c.employee);
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee);
      }
      const p = new NonRegularCustomPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else await p.delete(c);
    });
  }
});