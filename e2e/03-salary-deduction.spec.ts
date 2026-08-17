import { test, expect } from "@playwright/test";
import path from "node:path";
import { readAllSheets, type ExcelRow } from "./helpers/excel-reader";
import { HomestaffPage, type HomestaffCase } from "./pages/HomestaffPage";
import { ExpatLocalPage, type ExpatLocalCase } from "./pages/ExpatLocalPage";
import { apiLogin, ensureEmployeeRegulerThp, waitForSalaryDeductionRecordGone, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-salary-deduction.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function toHomestaff(row: ExcelRow): HomestaffCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase() as "add" | "edit" | "delete",
    employee: s(row.employee),
    period: s(row.period),
    rate: s(row.rate),
    mandatory: s(row.mandatory),
    pension: s(row.pension),
    dplkEmployer: s(row.dplkemployer),
    totalExpected: s(row.totalexpected),
    totalEmployerExpected: s(row.totalemployerexpected),
  };
}

function toExpatLocal(row: ExcelRow): ExpatLocalCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase() as "add" | "edit" | "delete",
    employee: s(row.employee),
    period: s(row.period),
    rate: s(row.rate),
    zakat: s(row.zakat),
    employeeDeduction: s(row.employeededuction),
    employeeSeguranca: s(row.employeeseguranca),
    employee13Seguranca: s(row.employee13seguranca),
    totalExpected: s(row.totalexpected),
    employerSeguranca: s(row.employerseguranca),
    employer13Seguranca: s(row.employer13seguranca),
    totalEmployerExpected: s(row.totalemployerexpected),
  };
}

const sheets = readAllSheets(DATA_FILE);

test.describe("Salary Deduction - Homestaff", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of (sheets.Homestaff ?? []).entries()) {
    const c = toHomestaff(row);
    const label = c.period ? `periode ${c.period}` : "tanpa period";
    test(`[Homestaff] ${c.action} - ${c.employee} (${label}) (#${idx + 1})`, async ({ page }) => {
      const { token } = await apiLogin(API_CFG);
      if (c.action === "add" || c.action === "edit") {
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee, s(row.category) || "Homestaff");
      }
      const p = new HomestaffPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else {
        await p.delete(c, () =>
          waitForSalaryDeductionRecordGone(API_CFG, token, "/api/master-salary-deduction-homestaff", c.employee, c.period),
        );
      }
    });
  }

  test("[Homestaff] Filter - Employer Contribution", async ({ page }) => {
    const p = new HomestaffPage(page);
    await p.goto();
    await p.filterType("Employer Contribution");
    await expect(page.locator("th", { hasText: "DPLK Employer Contribution" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Mandatory Housing Allowance" })).toHaveCount(0);
    await p.resetFilter();
    await expect(page.locator("th", { hasText: "Mandatory Housing Allowance" })).toBeVisible();
  });
});

test.describe("Salary Deduction - Expat Local", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of (sheets.ExpatLocal ?? []).entries()) {
    const c = toExpatLocal(row);
    const label = c.period ? `periode ${c.period}` : "tanpa period";
    test(`[Expat Local] ${c.action} - ${c.employee} (${label}) (#${idx + 1})`, async ({ page }) => {
      const { token } = await apiLogin(API_CFG);
      if (c.action === "add" || c.action === "edit") {
        await ensureEmployeeRegulerThp(API_CFG, token, c.employee, s(row.category) || "Expat");
      }
      const p = new ExpatLocalPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else {
        await p.delete(c, () =>
          waitForSalaryDeductionRecordGone(API_CFG, token, "/api/master-salary-deduction-expat-local", c.employee, c.period),
        );
      }
    });
  }

  test("[Expat Local] Filter - Employer Contribution", async ({ page }) => {
    const p = new ExpatLocalPage(page);
    await p.goto();
    await p.filterType("Employer Contribution");
    await expect(page.locator("th", { hasText: "Total Employer Contribution" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Zakat/THR Deduction" })).toHaveCount(0);
    await p.resetFilter();
    await expect(page.locator("th", { hasText: "Zakat/THR Deduction" })).toBeVisible();
  });
});