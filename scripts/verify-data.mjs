import XLSX from 'xlsx';
const wb = XLSX.readFile('D:/Work/Telkomcel/test/e2e/data/test-data-nonregular.xlsx');
for (const name of wb.SheetNames) {
  console.log(name, JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[name])));
}
