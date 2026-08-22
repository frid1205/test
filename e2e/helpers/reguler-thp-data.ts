import path from "node:path";
import { readSheet, type ExcelRow } from "./excel-reader";

/**
 * Sumber tunggal nilai Daftar Gaji (THP reguler): sheet "DaftarGaji" di
 * test-data.xlsx. Semua suite yang butuh THP baseline (non-regular, prorate,
 * benefit others, salary deduction) membaca dari sini -- tidak ada angka
 * hardcoded. Kalau data di Excel tidak konsisten, helper ini melempar error
 * dengan penjelasan supaya test-nya failed dengan alasan yang jelas.
 */
const DATA_FILE = path.resolve(import.meta.dirname, "..", "data", "test-data.xlsx");
const SHEET = "DaftarGaji";
const COMPONENTS = ["basic", "position", "expat", "home", "hotskill"] as const;

export interface RegulerThpBaseline {
  employee: string;
  category: string;
  basic: string;
  position: string;
  expat: string;
  home: string;
  hotskill: string;
  total: string;
}

function num(value: string | number | undefined): number {
  return value === undefined || value === "" ? 0 : Number(value);
}

function str(value: string | number | undefined): string {
  return value === undefined || value === "" ? "0" : String(value);
}

let cache: Map<string, RegulerThpBaseline> | undefined;

function load(): Map<string, RegulerThpBaseline> {
  if (cache) return cache;

  const rows: ExcelRow[] = readSheet(DATA_FILE, SHEET);
  const map = new Map<string, RegulerThpBaseline>();

  for (const row of rows) {
    const employee = String(row.employee ?? "").trim();
    if (!employee) continue;
    // Baris action=delete tidak punya nilai; lewati.
    if (COMPONENTS.every((key) => String(row[key] ?? "") === "")) continue;

    const sum = COMPONENTS.reduce((acc, key) => acc + num(row[key]), 0);
    const total = num(row.totalexpected);
    if (Math.round(sum * 100) !== Math.round(total * 100)) {
      throw new Error(
        `[${SHEET}] data tidak konsisten untuk "${employee}" (id ${row.id}): ` +
          `basic+position+expat+home+hotskill = ${sum}, tapi kolom totalExpected = ${total}. ` +
          `Perbaiki sheet "${SHEET}" di ${DATA_FILE}.`,
      );
    }

    // Baris terakhir per karyawan menang: Add lalu Edit = kondisi akhir THP.
    map.set(employee.toUpperCase(), {
      employee,
      category: String(row.category ?? "").trim(),
      basic: str(row.basic),
      position: str(row.position),
      expat: str(row.expat),
      home: str(row.home),
      hotskill: str(row.hotskill),
      total: String(total),
    });
  }

  if (map.size === 0) {
    throw new Error(`[${SHEET}] tidak ada baris data yang bisa dipakai di ${DATA_FILE}.`);
  }

  cache = map;
  return map;
}

/** Nilai THP karyawan sesuai sheet DaftarGaji. Throw kalau karyawannya tidak ada di sheet. */
export function getRegulerThpBaseline(name: string): RegulerThpBaseline {
  const map = load();
  const key = name.trim().toUpperCase();
  const found =
    map.get(key) ?? [...map.entries()].find(([k]) => k.includes(key) || key.includes(k))?.[1];

  if (!found) {
    throw new Error(
      `Karyawan "${name}" tidak ada di sheet "${SHEET}" (${DATA_FILE}). ` +
        `Nilai THP setiap karyawan harus berasal dari sheet itu, bukan dari nilai hardcoded. ` +
        `Nama yang tersedia: ${[...map.keys()].join(", ")}.`,
    );
  }

  return found;
}
