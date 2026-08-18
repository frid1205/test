import { test } from "@playwright/test";
import path from "node:path";
import { readSheet, type ExcelRow } from "./helpers/excel-reader";
import { CustomDeductionSettingPage, type CustomDeductionCase } from "./pages/CustomDeductionSettingPage";
import { apiLogin, deleteCustomDeductionByTitle, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-custom-deduction.xlsx");
const STORAGE_STATE = path.resolve(import.meta.dirname, ".auth", "user.json");

const API_CFG: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

function s(v: string | number | undefined, fallback = ""): string {
  return v === undefined || v === "" ? fallback : String(v);
}

function b(v: string | number | undefined): boolean {
  const x = String(v ?? "").trim().toLowerCase();
  return x === "true" || x === "1" || x === "yes";
}

function toCase(row: ExcelRow): CustomDeductionCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase() as CustomDeductionCase["action"],
    title: s(row.title),
    editTitle: s(row.edittitle),
    calculationType: (s(row.calculationtype, "Amount")) as CustomDeductionCase["calculationType"],
    appliesHomestaff: b(row.applieshomestaff),
    appliesExpatLocal: b(row.appliesexpatlocal),
    description: s(row.description),
    status: s(row.status, "active").toLowerCase() as CustomDeductionCase["status"],
  };
}

const rows = readSheet(DATA_FILE, "CustomDeduction");

test.describe.serial("Custom Deduction Setting", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of rows.entries()) {
    const c = toCase(row);
    test(`[Custom Deduction] ${c.action} - ${c.title} (#${idx + 1})`, async ({ page }) => {
      if (c.action === "add") {
        const { token } = await apiLogin(API_CFG);
        await deleteCustomDeductionByTitle(API_CFG, token, c.title);
        await deleteCustomDeductionByTitle(API_CFG, token, c.editTitle);
      }
      const p = new CustomDeductionSettingPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else await p.edit(c);
    });
  }
});
