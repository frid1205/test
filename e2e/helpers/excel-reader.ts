import XLSX from "xlsx";
import path from "node:path";

const DEFAULT_FILE = path.resolve(import.meta.dirname, "..", "data", "test-data.xlsx");

export type ExcelRow = Record<string, string | number>;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "");
}

export function readSheet(filePath: string, sheetName: string): ExcelRow[] {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" tidak ditemukan di ${filePath}`);
  const raw: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return raw.map((row) => {
    const out: ExcelRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[normalizeKey(key)] =
        typeof value === "string" ? value.trim() : value;
    }
    return out;
  });
}

export function readAllSheets(filePath: string = DEFAULT_FILE): Record<string, ExcelRow[]> {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const result: Record<string, ExcelRow[]> = {};
  for (const name of wb.SheetNames) {
    result[name] = readSheet(filePath, name);
  }
  return result;
}
