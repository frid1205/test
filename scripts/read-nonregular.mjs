import XLSX from 'xlsx';
const wb = XLSX.readFile('D:/Work/Telkomcel/test/e2e/data/test-data-nonregular.xlsx');
console.log('sheets:', wb.SheetNames);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Bfkj']);
console.log(JSON.stringify(rows, null, 1));
