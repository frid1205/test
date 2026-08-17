import XLSX from 'xlsx';

const base = { employee: 'RIMBUN SIBURIAN', period: '2026-08' };

const sheets = {
  Bfkj: [
    { id: 1, action: 'add', ...base, amount: 1500, totalexpected: 1500 },
    { id: 2, action: 'edit', ...base, amount: 1800, totalexpected: 1800 },
    { id: 3, action: 'delete', ...base, amount: '', totalexpected: '' },
  ],
  Hometrip: [
    { id: 1, action: 'add', ...base, amount: 1500, totalexpected: 1500 },
    { id: 2, action: 'edit', ...base, amount: 1800, totalexpected: 1800 },
    { id: 3, action: 'delete', ...base, amount: '', totalexpected: '' },
  ],
  Cutah: [
    { id: 1, action: 'add', ...base, rate: 50, totalexpected: '2083.33' },
    { id: 2, action: 'edit', ...base, rate: 60, totalexpected: '2500.00' },
    { id: 3, action: 'delete', ...base, rate: '', totalexpected: '' },
  ],
  GajiKe13: [
    { id: 1, action: 'add', ...base, basic: 500, position: 0, expat: 0, homestaff: 0, hotskill: 0, totalexpected: 500 },
    { id: 2, action: 'edit', ...base, basic: 500, position: 0, expat: 0, homestaff: 100, hotskill: 0, totalexpected: 600 },
    { id: 3, action: 'delete', ...base, basic: '', position: '', expat: '', homestaff: '', hotskill: '', totalexpected: '' },
  ],
  TunjanganKompetensi: [
    { id: 1, action: 'add', ...base, rate: 50, totalexpected: '2083.33' },
    { id: 2, action: 'edit', ...base, rate: 60, totalexpected: '2500.00' },
    { id: 3, action: 'delete', ...base, rate: '', totalexpected: '' },
  ],
  TunjanganJabatan2: [
    { id: 1, action: 'add', ...base, rate: 2, amount: 750, keterangan: 'test', totalexpected: 1500 },
    { id: 2, action: 'edit', ...base, rate: 2, amount: 900, keterangan: 'test', totalexpected: 1800 },
    { id: 3, action: 'delete', ...base, rate: '', amount: '', keterangan: '', totalexpected: '' },
  ],
};

const wb = XLSX.utils.book_new();
for (const [name, rows] of Object.entries(sheets)) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
}
XLSX.writeFile(wb, 'D:/Work/Telkomcel/test/e2e/data/test-data-nonregular.xlsx');
console.log('written sheets:', wb.SheetNames);
