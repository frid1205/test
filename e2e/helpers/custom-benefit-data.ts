import path from "node:path";
import { readSheet } from "./excel-reader";

/**
 * Nama tab komponen custom benefit dibaca dari sheet "CustomBenefit" di
 * test-data-custom-benefit.xlsx, bukan di-hardcode. Spec 01 membuat komponen
 * dengan kolom `title` lalu me-rename-nya ke `edittitle`, jadi kondisi akhir
 * yang dipakai suite lain adalah `edittitle` (fallback ke `title`).
 */
const DATA_FILE = path.resolve(import.meta.dirname, "..", "data", "test-data-custom-benefit.xlsx");
const SHEET = "CustomBenefit";

let cache: string | undefined;

export function customBenefitTabName(): string {
  if (cache) return cache;

  const rows = readSheet(DATA_FILE, SHEET);
  const edit = rows.find((r) => String(r.action ?? "").toLowerCase() === "edit");
  const add = rows.find((r) => String(r.action ?? "").toLowerCase() === "add");
  const name = String(edit?.edittitle || add?.title || "").trim();

  if (!name) {
    throw new Error(
      `[${SHEET}] kolom "edittitle"/"title" kosong di ${DATA_FILE}. ` +
        `Nama tab custom benefit harus berasal dari sheet itu, bukan dari nilai hardcoded.`,
    );
  }

  cache = name;
  return name;
}
