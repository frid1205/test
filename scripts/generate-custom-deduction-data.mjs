import XLSX from "xlsx";

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ";
const lorem500 = LOREM.repeat(Math.ceil(500 / LOREM.length)).slice(0, 500);

const base = {
  calculationtype: "Amount",
  applieshomestaff: "true",
  appliesexpatlocal: "true",
  description: lorem500,
  status: "active",
};

const rows = [
  {
    id: 1,
    action: "add",
    title: "Potongan iuran",
    edittitle: "Potongan Iuran Koperasi",
    ...base,
  },
  {
    id: 2,
    action: "edit",
    title: "Potongan iuran",
    edittitle: "Potongan Iuran Koperasi",
    ...base,
  },
  {
    id: 3,
    action: "add",
    title: "Potongan lain - lain",
    edittitle: "",
    ...base,
  },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "CustomDeduction");
XLSX.writeFile(wb, "D:/Work/Telkomcel/test/e2e/data/test-data-custom-deduction.xlsx");
console.log("written sheets:", wb.SheetNames);
