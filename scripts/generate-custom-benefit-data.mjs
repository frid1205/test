import XLSX from "xlsx";

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ";
const lorem500 = LOREM.repeat(Math.ceil(500 / LOREM.length)).slice(0, 500);

const field = (source, label, type, defaultvalue, mandatory, showontable) => ({
  source,
  label,
  type,
  defaultvalue,
  mandatory,
  showontable,
});

const addRow = {
  id: 1,
  action: "add",
  title: "Benefit lain - lain",
  edittitle: "Benefit others",
  sortorder: 5,
  status: "active",
  description: lorem500,
  formula: "[Salary]|*|[Amount]",
  editmandatoryfield: 2,
  f1source: "salary",
  f1label: "Salary",
  f1type: "Currency",
  f1defaultvalue: "0",
  f1mandatory: "true",
  f1showontable: "true",
  f2source: "custom",
  f2label: "Amount",
  f2type: "Number",
  f2defaultvalue: "0",
  f2mandatory: "true",
  f2showontable: "true",
  f3source: "custom",
  f3label: "Date",
  f3type: "Date",
  f3defaultvalue: "",
  f3mandatory: "false",
  f3showontable: "false",
  f4source: "custom",
  f4label: "Note",
  f4type: "Text",
  f4defaultvalue: "",
  f4mandatory: "false",
  f4showontable: "true",
};

const editRow = {
  id: 2,
  action: "edit",
  title: "Benefit lain - lain",
  edittitle: "Benefit others",
  sortorder: "",
  status: "",
  description: "",
  formula: "",
  editmandatoryfield: 2,
  f1source: "",
  f1label: "",
  f1type: "",
  f1defaultvalue: "",
  f1mandatory: "",
  f1showontable: "",
  f2source: "",
  f2label: "",
  f2type: "",
  f2defaultvalue: "",
  f2mandatory: "",
  f2showontable: "",
  f3source: "",
  f3label: "",
  f3type: "",
  f3defaultvalue: "",
  f3mandatory: "",
  f3showontable: "",
  f4source: "",
  f4label: "",
  f4type: "",
  f4defaultvalue: "",
  f4mandatory: "",
  f4showontable: "",
};

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([addRow, editRow]), "CustomBenefit");
XLSX.writeFile(wb, "D:/Work/Telkomcel/test/e2e/data/test-data-custom-benefit.xlsx");
console.log("written sheets:", wb.SheetNames);
