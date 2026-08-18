import { test, expect } from "@playwright/test";
import path from "node:path";
import { readSheet, type ExcelRow } from "./helpers/excel-reader";
import { CustomBenefitSettingPage, type CustomBenefitCase, type CustomBenefitFieldSpec } from "./pages/CustomBenefitSettingPage";
import { apiLogin, deleteCustomBenefitByTitle, type PayrollApiConfig } from "./helpers/api";
import { API_BASE_URL } from "./config";

const DATA_FILE = path.resolve(import.meta.dirname, "data", "test-data-custom-benefit.xlsx");
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

function toCase(row: ExcelRow): CustomBenefitCase {
  const fields: CustomBenefitFieldSpec[] = [];
  for (const n of [1, 2, 3, 4]) {
    const source = s(row[`f${n}source`]);
    if (!source) continue;
    fields.push({
      source: source as CustomBenefitFieldSpec["source"],
      label: s(row[`f${n}label`]),
      type: s(row[`f${n}type`], "Text") as CustomBenefitFieldSpec["type"],
      defaultValue: s(row[`f${n}defaultvalue`]),
      mandatory: b(row[`f${n}mandatory`]),
      showOnTable: b(row[`f${n}showontable`]),
    });
  }
  return {
    id: row.id,
    action: s(row.action).toLowerCase() as CustomBenefitCase["action"],
    title: s(row.title),
    editTitle: s(row.edittitle),
    sortOrder: s(row.sortorder),
    status: s(row.status, "active").toLowerCase() as CustomBenefitCase["status"],
    description: s(row.description),
    formula: s(row.formula).split("|").filter(Boolean),
    fields,
    editMandatoryField: Number(s(row.editmandatoryfield, "0")),
  };
}

const rows = readSheet(DATA_FILE, "CustomBenefit");
const addCase = toCase(rows.find((r) => s(r.action).toLowerCase() === "add")!);
const editCase = toCase(rows.find((r) => s(r.action).toLowerCase() === "edit")!);

test.describe.serial("Custom Benefit Setting", () => {
  test.use({ storageState: STORAGE_STATE });

  test(`[Custom Benefit] add - ${addCase.title}`, async ({ page }) => {
    const { token } = await apiLogin(API_CFG);
    await deleteCustomBenefitByTitle(API_CFG, token, addCase.title);
    await deleteCustomBenefitByTitle(API_CFG, token, editCase.editTitle);

    const p = new CustomBenefitSettingPage(page);
    await p.goto();
    await p.add(addCase);
  });

  test(`[Custom Benefit] edit - ${editCase.editTitle}`, async ({ page }) => {
    const p = new CustomBenefitSettingPage(page);
    await p.goto();
    await p.edit(editCase);
  });

  test(`[Custom Benefit] tab "${editCase.editTitle}" muncul di Payroll - Master KKP - Benefit`, async ({ page }) => {
    await page.goto("/benefit");
    await expect(page.getByRole("tab", { name: editCase.editTitle })).toBeVisible({ timeout: 60_000 });
  });
});
