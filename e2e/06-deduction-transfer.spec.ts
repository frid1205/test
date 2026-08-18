import { test } from "@playwright/test";
import path from "node:path";
import { readAllSheets, type ExcelRow } from "./helpers/excel-reader";
import { DeductionTransferPage, type DeductionTransferCase } from "./pages/DeductionTransferPage";
import { apiLogin, waitForDeductionTransferRecordGone, type PayrollApiConfig } from "./helpers/api";
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

function toDeductionTransfer(row: ExcelRow): DeductionTransferCase {
  return {
    id: row.id,
    action: s(row.action).toLowerCase() as "add" | "edit" | "delete",
    period: s(row.period),
    deductionType: s(row.deductiontype),
    transferTo: s(row.transferto),
    transferToLabel: s(row.transfertolabel),
    bankName: s(row.bankname),
    accountNumber: s(row.accountnumber),
    amount: s(row.amount, "0"),
  };
}

const sheets = readAllSheets(DATA_FILE);

test.describe("Deduction Transfer", () => {
  test.use({ storageState: STORAGE_STATE });

  for (const [idx, row] of (sheets.DeductionTransfer ?? []).entries()) {
    const c = toDeductionTransfer(row);
    const label = `${c.deductionType} (${c.period}) ke ${c.transferTo}`;
    test(`[Deduction Transfer] ${c.action} - ${label} (#${idx + 1})`, async ({ page }) => {
      const { token } = await apiLogin(API_CFG);
      const p = new DeductionTransferPage(page);
      await p.goto();
      if (c.action === "add") await p.add(c);
      else if (c.action === "edit") await p.edit(c);
      else {
        await p.delete(c, () =>
          waitForDeductionTransferRecordGone(API_CFG, token, c.period, c.transferTo, c.deductionType),
        );
      }
    });
  }
});