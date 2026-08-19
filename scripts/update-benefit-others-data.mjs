import XLSX from "xlsx";
import fs from "node:fs";

const benefitFile = "D:/Work/Telkomcel/test/e2e/data/test-data-custom-benefit.xlsx";
const payrollFile = "D:/Work/Telkomcel/test/e2e/data/test-data.xlsx";

function writeWithRename(filePath, wb) {
  const tmp = filePath.replace(/\.xlsx$/, ".new.xlsx");
  XLSX.writeFile(wb, tmp);
  try {
    fs.renameSync(tmp, filePath);
    console.log("updated: " + filePath);
  } catch (e) {
    console.log("LOCKED (close Excel): " + filePath + " -> " + tmp);
  }
}

// 1. Update custom benefit edittitle -> "Benefit Others"
const bwb = XLSX.readFile(benefitFile);
const bRows = XLSX.utils.sheet_to_json(bwb.Sheets["CustomBenefit"], { defval: "" });
for (const r of bRows) {
  r.edittitle = "Benefit Others";
}
bwb.Sheets["CustomBenefit"] = XLSX.utils.json_to_sheet(bRows);
writeWithRename(benefitFile, bwb);

// 2. Rename "Other" -> "Benefit Others" + isi data entry custom benefit
const pwb = XLSX.readFile(payrollFile);
const benefitOthers = [
  { id: 1, action: "Add", employee: "RIMBUN SIBURIAN", period: "2026-01", salary: 500, amount: 0.25, date: "2026-01-12", note: "Catatan January rimbun siburian" },
  { id: 2, action: "Edit", employee: "RIMBUN SIBURIAN", period: "2026-01", salary: 500, amount: 0.45, date: "2026-01-12", note: "Catatan January rimbun siburian" },
  { id: 3, action: "Delete", employee: "RIMBUN SIBURIAN", period: "2026-01", salary: 500, amount: 0.45, date: "2026-01-12", note: "Catatan January rimbun siburian" },
];
delete pwb.Sheets["Other"];
pwb.SheetNames = pwb.SheetNames.filter((n) => n !== "Other");
pwb.Sheets["Benefit Others"] = XLSX.utils.json_to_sheet(benefitOthers);
if (!pwb.SheetNames.includes("Benefit Others")) pwb.SheetNames.push("Benefit Others");
writeWithRename(payrollFile, pwb);
