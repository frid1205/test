import XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";

const filePath = path.resolve("D:\\Work\\Telkomcel\\test\\e2e\\data\\test-data.xlsx");

// 1. Read existing workbook
const wb = XLSX.readFile(filePath);

// New DaftarGaji rows based on the screenshots
const newDaftarGaji = [
  {
    id: 1,
    action: "Add",
    employee: "ADROALDINO DA SILVA NORONHA TOME",
    category: "Outsource",
    basic: "120",
    position: "10",
    expat: "0",
    home: "0",
    hotskill: "50",
    totalExpected: "180"
  },
  {
    id: 2,
    action: "Add",
    employee: "AGOSTINHO GOMES FERNANDES",
    category: "Expat",
    basic: "500",
    position: "1",
    expat: "1",
    home: "1",
    hotskill: "1",
    totalExpected: "500"
  },
  {
    id: 3,
    action: "Add",
    employee: "CELIA MARIA REGO DE FATIMA",
    category: "Local",
    basic: "300",
    position: "30",
    expat: "0",
    home: "0",
    hotskill: "10",
    totalExpected: "340"
  },
  {
    id: 4,
    action: "Add",
    employee: "DIAN EVIYANTI APLUGI",
    category: "Expat",
    basic: "200",
    position: "50",
    expat: "50",
    home: "0",
    hotskill: "0",
    totalExpected: "300"
  },
  {
    id: 5,
    action: "Add",
    employee: "AHMAD RIYANA SAPUTRA",
    category: "Expat",
    basic: "120",
    position: "40",
    expat: "60",
    home: "0",
    hotskill: "40",
    totalExpected: "260"
  },
  {
    id: 6,
    action: "Add",
    employee: "FRIESCA AMELIA",
    category: "Expat",
    basic: "500",
    position: "150",
    expat: "50",
    home: "0",
    hotskill: "0",
    totalExpected: "700"
  },
  {
    id: 7,
    action: "Add",
    employee: "HERU YULIANTO",
    category: "Homestaff",
    basic: "500",
    position: "150",
    expat: "0",
    home: "50",
    hotskill: "0",
    totalExpected: "700"
  },
  {
    id: 8,
    action: "Add",
    employee: "ALCINO DE FATIMA M. VALENTE",
    category: "Expat",
    basic: "60",
    position: "10",
    expat: "0",
    home: "0",
    hotskill: "30",
    totalExpected: "100"
  },
  {
    id: 9,
    action: "Add",
    employee: "RIMBUN SIBURIAN",
    category: "Local",
    basic: "500",
    position: "1",
    expat: "1",
    home: "1",
    hotskill: "1",
    totalExpected: "500"
  },
  {
    id: 10,
    action: "Add",
    employee: "SYALDY KHARISMA ANANDA",
    category: "Homestaff",
    basic: "200",
    position: "50",
    expat: "0",
    home: "20",
    hotskill: "30",
    totalExpected: "300"
  },
  {
    id: 11,
    action: "Add",
    employee: "Lestari Putri Cantika",
    category: "Homestaff",
    basic: "500",
    position: "1",
    expat: "1",
    home: "1",
    hotskill: "1",
    totalExpected: "500"
  },
  {
    id: 12,
    action: "Edit",
    employee: "RIMBUN SIBURIAN",
    category: "Local",
    basic: "500",
    position: "1",
    expat: "1",
    home: "1",
    hotskill: "1",
    totalExpected: "500"
  }
];

// Create backup first (only if not exists)
if (!fs.existsSync(filePath + ".bak")) {
  fs.copyFileSync(filePath, filePath + ".bak");
  console.log("Backup created: " + filePath + ".bak");
}

// Replace DaftarGaji sheet
const ws = XLSX.utils.json_to_sheet(newDaftarGaji);
wb.Sheets["DaftarGaji"] = ws;

// Write workbook to a temp file first (original may be locked by Excel)
const tmpPath = filePath + ".tmp";
XLSX.writeFile(wb, tmpPath);
console.log("Wrote temp file: " + tmpPath);

// Try to replace original
try {
  fs.renameSync(tmpPath, filePath);
  console.log("Excel file test-data.xlsx updated successfully!");
} catch (e) {
  console.log("Replace failed (file locked by Excel?): " + e.code);
  console.log("Updated file is available at: " + tmpPath);
}
