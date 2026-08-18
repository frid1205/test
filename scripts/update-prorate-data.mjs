import XLSX from "xlsx";
import fs from "node:fs";

const filePath = "D:/Work/Telkomcel/test/e2e/data/test-data.xlsx";

const wb = XLSX.readFile(filePath);

const otherProrate = [
  { id: 1, action: "Add", employee: "RIMBUN SIBURIAN", period: "2026-01", tarif: 10, rate: 2.3, payment: "Taxi online claim", remarks: "Remark taxi online claim" },
  { id: 2, action: "Edit", employee: "RIMBUN SIBURIAN", period: "2026-01", tarif: 10, rate: 2.5, payment: "Taxi online claim", remarks: "Remark taxi online claim updated" },
];

const prorate = [
  { id: 1, action: "Add", employee: "RIMBUN SIBURIAN", dateOfEntry: "2026-01-07", period: "2026-01", days: 31, from80: "2026-01-07", to80: "2026-01-14", from100: "2026-01-15", to100: "2026-01-31" },
  { id: 2, action: "Edit", employee: "RIMBUN SIBURIAN", dateOfEntry: "2026-01-07", period: "2026-01", days: 30, from80: "2026-01-07", to80: "2026-01-14", from100: "2026-01-15", to100: "2026-01-31" },
];

wb.Sheets["OtherProrate"] = XLSX.utils.json_to_sheet(otherProrate);
wb.Sheets["Prorate"] = XLSX.utils.json_to_sheet(prorate);
if (!wb.SheetNames.includes("OtherProrate")) wb.SheetNames.push("OtherProrate");
if (!wb.SheetNames.includes("Prorate")) wb.SheetNames.push("Prorate");

const tmpPath = filePath.replace(/\.xlsx$/, ".new.xlsx");
XLSX.writeFile(wb, tmpPath);

try {
  fs.renameSync(tmpPath, filePath);
  console.log("Sheets OtherProrate & Prorate added successfully.");
} catch (e) {
  console.log("Replace failed (file locked by Excel?): " + e.code);
  console.log("Updated file is available at: " + tmpPath);
  console.log("Close Excel then rename the .new.xlsx file over the original.");
}
