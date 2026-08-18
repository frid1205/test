import XLSX from "xlsx";
import fs from "node:fs";

const filePath = "D:/Work/Telkomcel/test/e2e/data/test-data-nonregular.xlsx";

const cutah = [
  { id: 1, action: "add", employee: "RIMBUN SIBURIAN", startperiod: "2026-08", endperiod: "2026-08", period: "2026-08", salary: "", rate: 50, totalexpected: "2083.33" },
  { id: 2, action: "edit", employee: "RIMBUN SIBURIAN", startperiod: "", endperiod: "", period: "2026-08", salary: 600, rate: 60, totalexpected: "3000.00" },
  { id: 3, action: "delete", employee: "RIMBUN SIBURIAN", startperiod: "", endperiod: "", period: "2026-08", salary: "", rate: "", totalexpected: "" },
];

const wb = XLSX.readFile(filePath);
wb.Sheets["Cutah"] = XLSX.utils.json_to_sheet(cutah);

const tmpPath = filePath.replace(/\.xlsx$/, ".new.xlsx");
XLSX.writeFile(wb, tmpPath);

try {
  fs.renameSync(tmpPath, filePath);
  console.log("Cutah sheet updated successfully.");
} catch (e) {
  console.log("Replace failed (file locked by Excel?): " + e.code);
  console.log("Updated file is available at: " + tmpPath);
  console.log("Close Excel then rename the .tmp file over the original.");
}
