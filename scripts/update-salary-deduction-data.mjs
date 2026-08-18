import XLSX from "xlsx";
import fs from "node:fs";

const filePath = "D:/Work/Telkomcel/test/e2e/data/test-data-salary-deduction.xlsx";

const wb = XLSX.readFile(filePath);

// --- Homestaff: tambah kolom custom "Potongan lain - lain" (100000 IDR -> +5 USD employee) ---
const homestaff = [
  { id: 1, action: "Add", employee: "Lestari Putri Cantika", category: "Homestaff", period: "2026-01", rate: 20000, mandatory: 200000, pension: 300000, dplkEmployer: 100000, "Potongan lain - lain": 100000, totalExpected: 30, totalEmployerExpected: 5 },
  { id: 2, action: "Edit", employee: "Lestari Putri Cantika", category: "Homestaff", period: "2026-01", rate: 20000, mandatory: 400000, pension: 300000, dplkEmployer: 100000, "Potongan lain - lain": 100000, totalExpected: 40, totalEmployerExpected: 5 },
  { id: 3, action: "Delete", employee: "Lestari Putri Cantika", category: "Homestaff", period: "2026-01", rate: 20000, mandatory: 400000, pension: 300000, dplkEmployer: 100000, "Potongan lain - lain": "", totalExpected: 40, totalEmployerExpected: 5 },
  { id: 4, action: "Add", employee: "Lestari Putri Cantika", category: "Homestaff", period: "", rate: 20000, mandatory: 500000, pension: 0, dplkEmployer: 0, "Potongan lain - lain": 100000, totalExpected: 30, totalEmployerExpected: 0 },
  { id: 5, action: "Delete", employee: "Lestari Putri Cantika", category: "Homestaff", period: "", rate: 20000, mandatory: 500000, pension: 0, dplkEmployer: 0, "Potongan lain - lain": "", totalExpected: 30, totalEmployerExpected: 0 },
];
wb.Sheets["Homestaff"] = XLSX.utils.json_to_sheet(homestaff);

// --- ExpatLocal: tambah kolom custom "Potongan lain - lain" (50 USD employee) ---
const expat = [
  { id: 1, action: "Add", employee: "AGOSTINHO GOMES FERNANDES", category: "Expat", period: "2026-02", rate: 20000, zakat: 500, employeeDeduction: 1000, employeeSeguranca: 100, employee13Seguranca: 50, "Potongan lain - lain": 50, totalExpected: 1700, employerSeguranca: 200, employer13Seguranca: 60, totalEmployerExpected: 260 },
  { id: 2, action: "Edit", employee: "AGOSTINHO GOMES FERNANDES", category: "Expat", period: "2026-02", rate: 20000, zakat: 500, employeeDeduction: 2000, employeeSeguranca: 100, employee13Seguranca: 50, "Potongan lain - lain": 50, totalExpected: 2700, employerSeguranca: 200, employer13Seguranca: 60, totalEmployerExpected: 260 },
  { id: 3, action: "Delete", employee: "AGOSTINHO GOMES FERNANDES", category: "Expat", period: "2026-02", rate: 20000, zakat: 500, employeeDeduction: 2000, employeeSeguranca: 100, employee13Seguranca: 50, "Potongan lain - lain": "", totalExpected: 2700, employerSeguranca: 200, employer13Seguranca: 60, totalEmployerExpected: 260 },
  { id: 4, action: "Add", employee: "AGOSTINHO GOMES FERNANDES", category: "Expat", period: "", rate: 20000, zakat: 500, employeeDeduction: 1000, employeeSeguranca: 100, employee13Seguranca: 50, "Potongan lain - lain": 50, totalExpected: 1700, employerSeguranca: 200, employer13Seguranca: 60, totalEmployerExpected: 260 },
  { id: 5, action: "Delete", employee: "AGOSTINHO GOMES FERNANDES", category: "Expat", period: "", rate: 20000, zakat: 500, employeeDeduction: 1000, employeeSeguranca: 100, employee13Seguranca: 50, "Potongan lain - lain": "", totalExpected: 1700, employerSeguranca: 200, employer13Seguranca: 60, totalEmployerExpected: 260 },
];
wb.Sheets["ExpatLocal"] = XLSX.utils.json_to_sheet(expat);

const tmpPath = filePath.replace(/\.xlsx$/, ".new.xlsx");
XLSX.writeFile(wb, tmpPath);

try {
  fs.renameSync(tmpPath, filePath);
  console.log("Salary deduction sheet updated successfully.");
} catch (e) {
  console.log("Replace failed (file locked by Excel?): " + e.code);
  console.log("Updated file is available at: " + tmpPath);
  console.log("Close Excel then rename the .new.xlsx file over the original.");
}
