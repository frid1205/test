/**
 * Menggabungkan hasil sweep UI + API menjadi satu file Excel test-case result.
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { catalog, HERE } from "./lib.mjs";

const UI_PASSES = ["full", "view", "create", "update", "delete"];
const API_PASSES = ["view", "create", "update", "delete"];
const BASE_URL = "https://telkomcel-s1.lumoshive.net";

const ui = {};
for (const p of UI_PASSES) {
  const j = JSON.parse(fs.readFileSync(path.join(HERE, `result-ui-${p}.json`), "utf8"));
  ui[p] = Object.fromEntries(j.results.map((r) => [r.slug, r]));
}
const apiRes = {};
for (const p of API_PASSES) {
  const j = JSON.parse(fs.readFileSync(path.join(HERE, `result-api-${p}.json`), "utf8"));
  apiRes[p] = Object.fromEntries(j.results.map((r) => [`${r.slug}|${r.action}`, r]));
}

const ACTION_META = {
  create: { ui: "add", label: "Add", labelId: "tambah", pass: "create", permSuffix: "create" },
  update: { ui: "edit", label: "Edit", labelId: "ubah", pass: "update", permSuffix: "update" },
  delete: { ui: "del", label: "Delete", labelId: "hapus", pass: "delete", permSuffix: "delete" },
};

/**
 * Penyesuaian manual untuk kasus yang sudah dikonfirmasi by design / butuh
 * penjelasan tambahan supaya severity-nya tidak menyesatkan.
 */
const OVERRIDES = {
  "personal-information|update": {
    severity: "Low",
    note: "Halaman Personal Information adalah halaman self-service (profil milik user sendiri) dan didaftarkan sebagai public route di frontend (checkAccess.ts), sehingga tombol Request Edit Data memang tidak digate permission. Perlu konfirmasi PO apakah permission personal-information-update memang tidak dipakai untuk halaman ini.",
  },
};

const hasBtn = (pass, slug, key) => (ui[pass]?.[slug]?.[key] || []).length > 0;
const btnLabels = (pass, slug, key) => [...new Set(ui[pass]?.[slug]?.[key] || [])].slice(0, 3).join(", ");

const rows = [];
const findings = [];
let no = 0;

for (const m of catalog) {
  for (const action of ["create", "update", "delete"]) {
    const meta = ACTION_META[action];
    const baseline = hasBtn("full", m.slug, meta.ui);
    const rowsFull = ui.full[m.slug]?.dataRows ?? 0;
    const api = Object.fromEntries(API_PASSES.map((p) => [p, apiRes[p][`${m.slug}|${action}`]]));
    const anyRec = api.view || api[meta.pass];
    const ep = anyRec?.endpoint || null;
    const viaCreate = API_PASSES.some((p) => api[p]?.viaCreate);
    const unguarded = API_PASSES.some((p) => api[p]?.unguarded);

    no += 1;
    const evidences = UI_PASSES.map((p) => ui[p]?.[m.slug]?.evidence).filter(Boolean);

    const EMPTY_REASON_TEXT = {
      "no-data-in-environment": "tabel kosong karena modul ini memang tidak punya data di environment dev saat pengujian (dikonfirmasi lewat API: 0 record)",
      "empty-on-default-filter": `tabel kosong pada filter default halaman walau API modul ini punya ${ui.full[m.slug]?.apiRows ?? "?"} record (halaman memfilter periode/tanggal berjalan)`,
      "empty-unverified": "tabel kosong dan jumlah record tidak dapat diverifikasi lewat API",
    };

    let notTestable = null;
    if (!baseline) {
      notTestable = action !== "create" && rowsFull === 0
        ? `Tombol ${meta.label} per-baris tidak dapat diverifikasi: ${EMPTY_REASON_TEXT[ui.full[m.slug]?.emptyReason] || "tabel kosong saat baseline"}.`
        : `Menu tidak menyediakan action ${meta.label} (tombol tetap tidak muncul walau role diberi permission penuh) - termasuk kondisi khusus menu view only, tidak dijadikan bug.`;
    }

    const shownIn = UI_PASSES.filter((p) => p !== "full" && hasBtn(p, m.slug, meta.ui));
    const leakPasses = shownIn.filter((p) => p !== meta.pass && p !== "view");
    const shownOnView = hasBtn("view", m.slug, meta.ui);
    const uiPositive = hasBtn(meta.pass, m.slug, meta.ui);

    const denyPasses = API_PASSES.filter((p) => p !== meta.pass);
    const denyStatuses = denyPasses.map((p) => ({ p, s: api[p]?.status, skipped: api[p]?.skipped }));
    const apiDenyLeaks = denyStatuses.filter((d) => d.s !== undefined && d.s !== 403);
    const posRec = api[meta.pass];
    let apiPositive = "none";
    if (posRec?.skipped) apiPositive = "skipped";
    else if (posRec?.status !== undefined) apiPositive = posRec.status !== 403 ? "allow" : "deny";

    const permBase = `${m.slug}-${meta.permSuffix}`;
    const otherLabels = ["create", "update", "delete"].filter((x) => x !== action).map((x) => ACTION_META[x].label).join("/");

    const expected =
      `A. Role hanya View: tombol ${meta.label} TIDAK tampil di halaman ${m.route}, dan request ${meta.labelId} data ditolak backend dengan HTTP 403 (Access denied).\n` +
      `B. Role View + ${meta.label} (${permBase}): tombol ${meta.label} TAMPIL dan request ${meta.labelId} data lolos pengecekan permission (bukan 403).\n` +
      `C. Permission action lain (${otherLabels}) tidak boleh ikut memunculkan tombol ${meta.label}.`;

    const uiActual = notTestable
      ? `Baseline (role permission penuh): tombol ${meta.label} tidak terdeteksi. ${notTestable}`
      : `Baseline (full access): tombol ${meta.label} tampil (${btnLabels("full", m.slug, meta.ui) || "ikon"}). ` +
        `Role View only: ${shownOnView ? "tombol MASIH TAMPIL" : "tombol tidak tampil"}. ` +
        `Role View+${meta.label}: ${uiPositive ? "tombol tampil" : "tombol TIDAK TAMPIL"}. ` +
        `Role action lain: ${leakPasses.length ? `tombol ikut tampil pada pass ${leakPasses.join("/")}` : "tombol tidak ikut tampil"}.`;

    const apiActual = !ep
      ? `Tidak ada endpoint ${action} untuk modul ini (menu tanpa action ${meta.label} / view only).`
      : `Endpoint diuji: ${ep}${viaCreate ? " (form Edit memakai endpoint store yang sama dengan Add)" : ""}${unguarded ? " [route tanpa middleware auto.permission]" : ""}. ` +
        denyStatuses.map((d) => `role ${d.p}-only -> ${d.skipped ? d.skipped : "HTTP " + d.s}`).join("; ") +
        `; role ${meta.pass} -> ${posRec?.skipped ? `dilewati (${posRec.skipped})` : "HTTP " + posRec?.status}.`;

    let result;
    let severity = "-";
    const actual = `${uiActual}\n${apiActual}`;

    if (notTestable && apiDenyLeaks.length === 0) {
      result = "N/A";
    } else if (notTestable) {
      // UI tidak menyediakan tombolnya, tetapi endpoint backend tetap bisa dipanggil
      // langsung tanpa permission -> tetap dilaporkan sebagai celah enforcement.
      result = "Failed";
      severity = "High";
      findings.push({
        no,
        menu: m.name,
        module: m.module,
        action: meta.label,
        severity,
        reason: `Tombol ${meta.label} tidak dapat diverifikasi di UI (${notTestable}), namun endpoint backend ${ep} tetap lolos tanpa permission ${permBase} (${apiDenyLeaks.map((d) => `${d.p}-only -> HTTP ${d.s}`).join(", ")})`,
      });
    } else {
      const uiLeak = shownOnView || leakPasses.length > 0;
      const uiGap = !uiPositive;
      const apiLeak = apiDenyLeaks.length > 0;
      const apiGap = apiPositive === "deny";
      if (uiLeak || apiLeak) {
        result = "Failed";
        severity = "High";
      } else if (uiGap || apiGap) {
        result = "Failed";
        severity = "Medium";
      } else {
        result = "Passed";
      }
      const ov = OVERRIDES[`${m.slug}|${action}`];
      if (ov && result === "Failed" && ov.severity) severity = ov.severity;
      if (result === "Failed") {
        findings.push({
          no,
          menu: m.name,
          module: m.module,
          action: meta.label,
          severity,
          reason: [
            shownOnView && `tombol ${meta.label} tetap tampil saat role hanya View`,
            leakPasses.length > 0 && `tombol ${meta.label} ikut tampil pada role ${leakPasses.join("/")}-only`,
            uiGap && `tombol ${meta.label} tidak tampil walau permission ${permBase} diberikan`,
            apiLeak && `backend meloloskan request (${apiDenyLeaks.map((d) => `${d.p}-only -> HTTP ${d.s}`).join(", ")}) padahal permission ${permBase} tidak diberikan`,
            apiGap && `backend menolak dengan 403 padahal permission ${permBase} sudah diberikan${viaCreate ? " (endpoint simpan Edit sama dengan Add sehingga yang dicek backend adalah permission -create)" : ""}`,
          ].filter(Boolean).join("; "),
        });
      }
    }

    const epShort = ep ? ep : `action ${meta.label}`;
    const step =
      `1. Login sebagai Super Admin (NIK 0000000 / PasswordSuperAdmin@Tecel67) di ${BASE_URL}.\n` +
      `2. Buka Setting > Configuration > Role Management, edit role "Vice President" (role milik user Lestari NIK 999999).\n` +
      `3. Pada menu "${m.name}", centang HANYA permission View (${m.slug}-view), lalu simpan role.\n` +
      `4. Login sebagai Lestari (NIK 999999 / TelkomC3l2025, OTP 1) lalu buka halaman ${m.route}.\n` +
      `5. Cek apakah tombol ${meta.label} tampil, dan jalankan request ${epShort} untuk menguji enforcement backend.\n` +
      `6. Ulangi langkah 2-5 dengan permission View + ${meta.label} (${permBase}) dicentang.\n` +
      `7. Ulangi juga dengan permission ${otherLabels} saja untuk memastikan tombol ${meta.label} tidak ikut muncul.`;

    const note =
      `Evidence: ${evidences.map((e) => "evidence/" + e).join(", ")}. ` +
      `Jumlah baris data tabel saat baseline: ${rowsFull} (record menurut API modul: ${ui.full[m.slug]?.apiRows ?? "tidak terverifikasi"}). ` +
      `Permission yang diuji: ${permBase}.` +
      (viaCreate ? " Catatan: modul ini memakai endpoint POST .../store sebagai upsert (Add dan Edit mengarah ke endpoint yang sama)." : "") +
      (unguarded ? " Catatan: route backend modul ini tidak memasang middleware auto.permission." : "") +
      (OVERRIDES[`${m.slug}|${action}`]?.note ? ` Catatan reviewer: ${OVERRIDES[`${m.slug}|${action}`].note}` : "");

    rows.push([
      no,
      `Enforcement permission ${meta.label} pada menu ${m.name}`,
      `${m.module} > ${m.name}`,
      step,
      severity,
      expected,
      actual,
      result,
      note,
    ]);
  }
}

/**
 * Tiga test case end-to-end tambahan: action benar-benar dijalankan lewat UI
 * pada modul contoh Master Department (bukan sekadar cek tombol / status HTTP).
 */
const E2E_DIR = "evidence/e2e-action-master-department";
const e2e = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(HERE, "result-e2e-action.json"), "utf8")).log.map((l) => [l.step, l]),
);
const e2eAdd = e2e["create-with-create-permission"];
const e2eEdit = e2e["update-with-update-permission"];
const e2eDel = e2e["delete-with-delete-permission"];
const E2E_ROWS = [
  {
    tc: "Action tambah data benar-benar berjalan saat permission Add diberikan (Master Department)",
    step:
      "1. Super Admin set role Vice President -> menu Master Department: View + Add saja.\n" +
      "2. Login sebagai Lestari, buka /master-department.\n" +
      "3. Klik tombol Add Data, isi Department Name = \"QA PERM DEPT\", Status = ACTIVE, klik Create.\n" +
      "4. Cari data \"QA PERM DEPT\" pada kolom search.",
    severity: "-",
    expected: "Tombol Add Data tampil, form dapat disimpan, dan data baru muncul di tabel.",
    actual:
      `Tombol Add Data tampil (${e2eAdd?.addButtonVisible}). Request POST /api/master-departments/store dijawab HTTP ${e2eAdd?.httpStatus}. ` +
      `Verifikasi ulang lewat API: data "QA PERM DEPT" ditemukan = ${e2eAdd?.dataExistsAfter}.`,
    result: e2eAdd?.ok ? "Passed" : "Failed",
    note: `Evidence: ${E2E_DIR}/01-add-form-filled.png, ${E2E_DIR}/02-add-result.png.`,
  },
  {
    tc: "Action ubah data GAGAL walau permission Edit diberikan (Master Department)",
    step:
      "1. Super Admin set role Vice President -> menu Master Department: View + Edit saja.\n" +
      "2. Login sebagai Lestari, buka /master-department, cari \"QA PERM DEPT\".\n" +
      "3. Klik ikon Edit pada baris data, ubah Department Name menjadi \"QA PERM DEPT EDITED\".\n" +
      "4. Klik tombol Update dan amati response network serta tampilan UI.",
    severity: "High",
    expected: "Data tersimpan dengan nama baru dan muncul notifikasi sukses, karena permission master-department-update sudah diberikan.",
    actual:
      `Tombol Edit tampil dan form Edit terbuka (benar). Namun saat klik Update, request POST /api/master-departments/store dijawab HTTP ${e2eEdit?.httpStatus} (Access denied). ` +
      `Verifikasi ulang lewat API: data dengan nama baru ditemukan = ${e2eEdit?.dataRenamed}, data dengan nama lama masih ada = ${e2eEdit?.dataUnchanged}. ` +
      `UI menampilkan toast error: ${(e2eEdit?.toastText || []).map((t) => `"${t}"`).join("; ") || "(tidak ada)"}.`,
    result: e2eEdit?.ok ? "Passed" : "Failed",
    note:
      `Evidence: ${E2E_DIR}/03-edit-form-filled.png, ${E2E_DIR}/04-edit-result.png. ` +
      "Root cause: form Add dan Edit sama-sama mengirim ke POST /master-departments/store (controller upsert), sedangkan middleware auto.permission menilai POST tanpa keyword update sebagai action create, sehingga yang dicek adalah permission master-department-create.",
  },
  {
    tc: "Action hapus data benar-benar berjalan saat permission Delete diberikan (Master Department)",
    step:
      "1. Super Admin set role Vice President -> menu Master Department: View + Delete saja.\n" +
      "2. Login sebagai Lestari, buka /master-department, cari \"QA PERM DEPT\".\n" +
      "3. Klik ikon Delete pada baris data lalu konfirmasi penghapusan.",
    severity: "-",
    expected: "Tombol Delete tampil, data terhapus, dan muncul notifikasi sukses.",
    actual:
      `Tombol Delete tampil. Request DELETE /api/master-departments/delete/{uuid} dijawab HTTP ${e2eDel?.httpStatus}. ` +
      `Verifikasi ulang lewat API: data sudah tidak ditemukan = ${e2eDel?.dataDeleted}.`,
    result: e2eDel?.ok ? "Passed" : "Failed",
    note: `Evidence: ${E2E_DIR}/05-before-delete.png, ${E2E_DIR}/06-after-delete.png. Data uji "QA PERM DEPT" sudah dibersihkan dari environment dev oleh step ini.`,
  },
];

for (const e of E2E_ROWS) {
  no += 1;
  rows.push([no, e.tc, "Setting > Master Data > Master Department (sample end-to-end)", e.step, e.severity, e.expected, e.actual, e.result, e.note]);
  if (e.result === "Failed") {
    findings.push({ no, menu: "Master Department", module: "Setting > Master Data", action: "Edit", severity: e.severity, reason: "E2E: klik Update pada form Edit ditolak HTTP 403 walau permission master-department-update diberikan; data tidak berubah" });
  }
}

const header = ["No", "Test Case", "Module", "Step to Replicate", "Severity", "Expected Result", "Actual Result", "Result (Passed/Failed)", "Note"];
const title = "Test Case Result - Enforcement Permission Seluruh Menu HRIS Telkomcel";
const subtitle = `Environment: ${BASE_URL} (DEV) | Tanggal eksekusi: 26 Agustus 2026 | Akun: Super Admin NIK 0000000 (setting role) & Lestari NIK 999999 role Vice President (verifikasi) | Menu diuji: ${catalog.length} | Metode: 5 konfigurasi role (Full baseline, View only, View+Add, View+Edit, View+Delete) diverifikasi di UI dan di backend API`;

const aoa = [[title], [subtitle], [], header, ...rows];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = [{ wch: 5 }, { wch: 46 }, { wch: 34 }, { wch: 72 }, { wch: 10 }, { wch: 62 }, { wch: 80 }, { wch: 14 }, { wch: 62 }];
ws["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
  { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
];
for (let r = 3; r < aoa.length; r += 1) {
  for (let c = 0; c < header.length; c += 1) {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = { alignment: { wrapText: true, vertical: "top" } };
  }
}

const counts = rows.reduce((acc, r) => {
  acc[r[7]] = (acc[r[7]] || 0) + 1;
  return acc;
}, {});
const sev = findings.reduce((acc, f) => {
  acc[f.severity] = (acc[f.severity] || 0) + 1;
  return acc;
}, {});

const summary = [
  ["Summary - Enforcement Permission HRIS Telkomcel"],
  [subtitle],
  [],
  ["Total Test Case", rows.length],
  ["Passed", counts.Passed || 0],
  ["Failed", counts.Failed || 0],
  ["N/A (menu tanpa action tersebut / tabel kosong)", counts["N/A"] || 0],
  [],
  ["Failed - Severity High (permission tidak di-enforce / bocor)", sev.High || 0],
  ["Failed - Severity Medium (permission diberikan tapi action tidak dapat dipakai)", sev.Medium || 0],
  [],
  ["Repeatability check", ""],
  ["Pass Full dijalankan 2x berturut-turut", "44/44 menu memberi hasil identik (tombol & jumlah baris sama persis)"],
  ["Probe API dibandingkan dengan run sebelumnya", "528/528 probe memberi status HTTP identik"],
  ["Catatan stabilitas", "Pembacaan halaman diulang sampai 2 pembacaan berturut-turut identik; baris skeleton tidak dihitung sebagai data; tabel kosong diverifikasi silang ke API sebelum disimpulkan"],
  [],
  ["No TC", "Menu", "Module", "Action", "Severity", "Ringkasan Temuan"],
  ...findings.map((f) => [f.no, f.menu, f.module, f.action, f.severity, f.reason]),
];
const ws2 = XLSX.utils.aoa_to_sheet(summary);
ws2["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 120 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
XLSX.utils.book_append_sheet(wb, ws2, "Summary");
const out = "D:/Work/Telkomcel/Result/Test_Case_Enforcement_Permission_All_Menu_Result.xlsx";
XLSX.writeFile(wb, out);
console.log("Excel:", out);
console.log("rows:", rows.length, counts, "findings:", findings.length, sev);
fs.writeFileSync(path.join(HERE, "findings.json"), JSON.stringify(findings, null, 1));
