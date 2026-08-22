import path from "node:path";
import { readSheet } from "./excel-reader";
import { getRegulerThpBaseline } from "./reguler-thp-data";

export interface PayrollApiConfig {
  baseUrl: string;
  nik: string;
  password: string;
  appName?: string;
  appKey?: string;
}

export interface LoginResult {
  token: string;
  user: unknown;
  profile: unknown;
}

export async function apiLogin(cfg: PayrollApiConfig): Promise<LoginResult> {
  const form = new URLSearchParams({ app: cfg.appName ?? "HRISAPPS", nik: cfg.nik, password: cfg.password });
  const res = await fetch(`${cfg.baseUrl}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${cfg.appKey ?? "your-app-key"}`,
    },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(`Login API failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("Login API returned no token");
  const me = await fetch(`${cfg.baseUrl}/api/me`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  if (!me.ok) {
    throw new Error(`Fetch /api/me failed: ${me.status} ${await me.text()}`);
  }
  const profile = await me.json();
  if (profile.profile_photo !== undefined) {
    profile.image = profile.profile_photo;
    delete profile.profile_photo;
  }
  if (profile.current_position !== undefined) {
    profile.position = profile.current_position;
    delete profile.current_position;
  }
  profile.position = profile.position || "-";
  return { token: data.token, user: data.user, profile };
}

interface DeleteList {
  searchUrl: string;
  deleteUrlPrefix: string;
}

/** Karyawan uji — data payroll mereka dihapus setiap kali test dijalankan. */
const CLEANUP_EMPLOYEES: string[] = [
  "RIMBUN SIBURIAN",
  "CELIA MARIA REGO DE FATIMA",
  "ADROALDINO DA SILVA NORONHA TOME",
  "DIAN EVIYANTI APLUGI",
  "FRIESCA AMELIA",
  "HERU YULIANTO",
  "SYALDY KHARISMA ANANDA",
  "AFNI PASCALIA VIDAPRIYANTI TAE",
  "DAVID KIM RODRIGUEZ",
  "Lestari Putri Cantika",
  "AGOSTINHO GOMES FERNANDES",
];

function employeeIsCleanupTarget(rec: unknown): boolean {
  if (!rec || typeof rec !== "object") return false;
  const r = rec as Record<string, unknown>;
  const names: unknown[] = [
    r.employee_name,
    (r.employee_personal_info as Record<string, unknown> | undefined)?.name,
    (r.employee as Record<string, unknown> | undefined)?.name,
  ];
  return names.some(
    (n) =>
      typeof n === "string" &&
      CLEANUP_EMPLOYEES.some((target) => n.toUpperCase().includes(target.toUpperCase())),
  );
}

async function deleteRecordsForEmployee(token: string, cfg: PayrollApiConfig, list: DeleteList): Promise<number> {
  let deleted = 0;
  let page = 1;
  let lastPage = 1;
  do {
    const listParams = new URLSearchParams({ per_page: "200", page: String(page) });
    const listRes = await fetch(`${cfg.baseUrl}${list.searchUrl}?${listParams}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      console.warn(`[cleanup] list ${list.searchUrl} -> ${listRes.status}, skipped`);
      return deleted;
    }
    const payload = await listRes.json();
    const records: Array<{ uuid: string }> = (payload?.data ?? []).filter(employeeIsCleanupTarget);
    for (const rec of records) {
      const delRes = await fetch(`${cfg.baseUrl}${list.deleteUrlPrefix}${rec.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok || delRes.status === 404) deleted++;
      else console.warn(`[cleanup] delete ${rec.uuid} -> ${delRes.status} ${await delRes.text()}`);
    }
    lastPage = payload?.last_page ?? 1;
    page++;
  } while (page <= lastPage);
  return deleted;
}

/**
 * Salary-deduction (homestaff & expat local) punya perilaku khusus: list dengan
 * filter bulan kosong hanya mengembalikan record yang period-nya kosong (default).
 * Record berperiode baru tampil jika query menyertakan `month=YYYY-MM`. Cleanup
 * harus iterasi bulan (termasuk tanpa filter) agar record berperiode ikut terhapus.
 */
async function deleteSalaryDeductionRecordsForEmployee(
  token: string,
  cfg: PayrollApiConfig,
  list: DeleteList,
): Promise<number> {
  const queries: string[] = [""];
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  for (const y of years) {
    for (const m of ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]) {
      queries.push(`month=${y}-${m}`);
    }
  }

  const uuids = new Set<string>();
  for (const q of queries) {
    let page = 1;
    let lastPage = 1;
    do {
      const listParams = new URLSearchParams({ per_page: "200", page: String(page) });
      const listRes = await fetch(`${cfg.baseUrl}${list.searchUrl}?${q ? `${q}&` : ""}${listParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) {
        console.warn(`[cleanup] list ${list.searchUrl}?${q} -> ${listRes.status}, skipped`);
        break;
      }
      const payload = await listRes.json();
      for (const rec of (payload?.data ?? [])) {
        if (employeeIsCleanupTarget(rec)) uuids.add((rec as { uuid: string }).uuid);
      }
      lastPage = payload?.last_page ?? 1;
      page++;
    } while (page <= lastPage);
  }

  let deleted = 0;
  for (const uuid of uuids) {
    const delRes = await fetch(`${cfg.baseUrl}${list.deleteUrlPrefix}${uuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok || delRes.status === 404) deleted++;
    else console.warn(`[cleanup] delete ${uuid} -> ${delRes.status} ${await delRes.text()}`);
  }
  return deleted;
}

/**
 * Verifikasi bahwa record salary-deduction benar-benar sudah tidak ada di server.
 * Dipanggil setelah test delete selesai dari sisi UI. Response DELETE yang ok
 * tidak selalu berarti data sudah tidak ada (commit async / eventual consistency),
 * jadi di-poll sampai record karyawan (dengan period yang sama) hilang.
 */
export async function waitForSalaryDeductionRecordGone(
  cfg: PayrollApiConfig,
  token: string,
  searchUrl: string,
  employeeName: string,
  period: string,
  timeoutMs = 30_000,
): Promise<void> {
  const upper = employeeName.toUpperCase();
  const q = period ? `month=${period}` : "";
  const deadline = Date.now() + timeoutMs;
  let stillPresent = true;
  while (Date.now() < deadline) {
    const listParams = new URLSearchParams({ per_page: "200" });
    const listRes = await fetch(`${cfg.baseUrl}${searchUrl}?${q ? `${q}&` : ""}${listParams}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const payload = await listRes.json();
      stillPresent = (payload?.data ?? []).some((rec: unknown) => {
        if (!rec || typeof rec !== "object") return false;
        const r = rec as Record<string, unknown>;
        const names: unknown[] = [
          r.employee_name,
          (r.employee_personal_info as Record<string, unknown> | undefined)?.name,
          (r.employee as Record<string, unknown> | undefined)?.name,
        ];
        return names.some((n) => typeof n === "string" && n.toUpperCase().includes(upper));
      });
      if (!stillPresent) return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `waitForSalaryDeductionRecordGone: record "${employeeName}" (${period || "tanpa period"}) masih ada di server setelah delete`,
  );
}

const DEDUCTION_TRANSFER_DATA_FILE = path.resolve(
  import.meta.dirname,
  "..",
  "data",
  "test-data-salary-deduction.xlsx",
);

/** Ambil daftar record dari list endpoint (data bisa array atau objek dengan kunci numerik). */
async function fetchListData(baseUrl: string, token: string, endpoint: string): Promise<Array<Record<string, unknown>>> {
  const listParams = new URLSearchParams({ per_page: "200", page: "1" });
  const res = await fetch(`${baseUrl}/api${endpoint}?${listParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const body = await res.json();
  const data = body?.data;
  return Array.isArray(data) ? data : data ? Object.values(data) : [];
}

/** Tanda tangan record deduction-transfer milik test = (period|transfer_to|deduction_type) dari sheet Excel. */
function isDeductionTransferTestRecord(rec: Record<string, unknown>): boolean {
  let rows: Array<Record<string, string | number>>;
  try {
    rows = readSheet(DEDUCTION_TRANSFER_DATA_FILE, "DeductionTransfer");
  } catch {
    return false;
  }
  const sig = new Set(
    rows.map((r) =>
      [
        String(r.period ?? "").trim(),
        String(r.transferto ?? "").trim().toUpperCase(),
        String(r.deductiontype ?? "").trim().toUpperCase(),
      ].join("|"),
    ),
  );
  const period = String(rec.period ?? "").trim();
  const transferTo = String(rec.transfer_to ?? "").trim().toUpperCase();
  const deductionType = String(rec.deduction_type ?? "").trim().toUpperCase();
  return sig.has(`${period}|${transferTo}|${deductionType}`);
}

/**
 * Hapus record deduction-transfer milik test (tanda tangan dari sheet
 * "DeductionTransfer" di file Excel yang sama dengan spec). Record dibuat lewat
 * UI form yang tidak punya field amount; identitas record adalah
 * (period, transfer_to, deduction_type), bukan employee.
 */
export async function cleanupDeductionTransferRecords(cfg: PayrollApiConfig, token: string): Promise<number> {
  const records = await fetchListData(cfg.baseUrl, token, "/deduction-transfer");
  let deleted = 0;
  for (const rec of records) {
    if (!isDeductionTransferTestRecord(rec)) continue;
    const uuid = rec.uuid as string;
    const delRes = await fetch(`${cfg.baseUrl}/api/deduction-transfer/delete/${uuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok || delRes.status === 404) deleted++;
    else console.warn(`[cleanup] delete deduction-transfer ${uuid} -> ${delRes.status} ${await delRes.text()}`);
  }
  console.log(`[cleanup] /deduction-transfer: ${deleted} record(s) deleted`);
  return deleted;
}

/**
 * Verifikasi bahwa record deduction-transfer benar-benar sudah tidak ada di server
 * setelah test delete. Polling list sampai record dengan (period, transfer_to,
 * deduction_type) yang sama hilang.
 */
export async function waitForDeductionTransferRecordGone(
  cfg: PayrollApiConfig,
  token: string,
  period: string,
  transferTo: string,
  deductionType: string,
  timeoutMs = 30_000,
): Promise<void> {
  const upperTo = transferTo.toUpperCase();
  const upperType = deductionType.toUpperCase();
  const deadline = Date.now() + timeoutMs;
  let stillPresent = true;
  while (Date.now() < deadline) {
    const listParams = new URLSearchParams({ per_page: "200", page: "1", period });
    const res = await fetch(`${cfg.baseUrl}/api/deduction-transfer?${listParams}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = await res.json();
      const data = Array.isArray(body?.data) ? body.data : body?.data ? Object.values(body.data) : [];
      stillPresent = data.some(
        (rec: Record<string, unknown>) =>
          String(rec.period ?? "").trim() === period &&
          String(rec.transfer_to ?? "").trim().toUpperCase().includes(upperTo) &&
          String(rec.deduction_type ?? "").trim().toUpperCase() === upperType,
      );
      if (!stillPresent) return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `waitForDeductionTransferRecordGone: record "${transferTo}" "${deductionType}" (${period}) masih ada di server setelah delete`,
  );
}

/**
 * Hapus semua data payroll milik karyawan uji (lihat CLEANUP_EMPLOYEES):
 * daftar gaji (THP), benefit district, overtime, pulsa, medical, other,
 * salary deduction homestaff & expat local.
 */
export async function cleanupTestPayrollData(cfg: PayrollApiConfig, token: string): Promise<void> {
  const targets: DeleteList[] = [
    { searchUrl: "/api/master-reguler-thp", deleteUrlPrefix: "/api/master-reguler-thp/delete/" },
    { searchUrl: "/api/master-benefit-district", deleteUrlPrefix: "/api/master-benefit-district/delete/" },
    { searchUrl: "/api/master-benefit-overtime", deleteUrlPrefix: "/api/master-benefit-overtime/delete/" },
    { searchUrl: "/api/master-all-benefit-and-others/PhoneCredit", deleteUrlPrefix: "/api/master-all-benefit-and-others/delete/" },
    { searchUrl: "/api/master-all-benefit-and-others/Medical", deleteUrlPrefix: "/api/master-all-benefit-and-others/delete/" },
    { searchUrl: "/api/master-all-benefit-and-others/Others", deleteUrlPrefix: "/api/master-all-benefit-and-others/delete/" },
    { searchUrl: "/api/master-prorate-others", deleteUrlPrefix: "/api/master-prorate-others/delete/" },
    { searchUrl: "/api/master-prorate", deleteUrlPrefix: "/api/master-prorate/delete/" },
    { searchUrl: "/api/master-salary-deduction-homestaff", deleteUrlPrefix: "/api/master-salary-deduction-homestaff/delete/" },
    { searchUrl: "/api/master-salary-deduction-expat-local", deleteUrlPrefix: "/api/master-salary-deduction-expat-local/delete/" },
  ];
  for (const t of targets) {
    const isDeduction = t.searchUrl.includes("salary-deduction");
    const n = isDeduction
      ? await deleteSalaryDeductionRecordsForEmployee(token, cfg, t)
      : await deleteRecordsForEmployee(token, cfg, t);
    console.log(`[cleanup] ${t.searchUrl}: ${n} record(s) deleted`);
  }
  await cleanupDeductionTransferRecords(cfg, token);
}

/**
 * Pastikan karyawan punya daftar gaji (THP reguler) di server sesuai sheet
 * "DaftarGaji" di test-data.xlsx -- bukan nilai hardcoded. Dipakai suite
 * non-regular / prorate / benefit others / salary deduction supaya field Salary
 * yang auto-fill dari THP memakai angka yang sama dengan data Excel.
 * Kalau THP sudah ada, nilainya di-reset ke nilai Excel (suite payroll yang
 * jalan duluan bisa mengubahnya).
 */
export async function ensureEmployeeRegulerThp(cfg: PayrollApiConfig, token: string, name: string, category?: string): Promise<void> {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const baseline = getRegulerThpBaseline(name);

  if (category && baseline.category && category !== baseline.category) {
    console.warn(
      `[ensureEmployeeRegulerThp] category "${category}" dari sheet pemanggil beda dengan sheet DaftarGaji ` +
        `("${baseline.category}") untuk "${name}" -- memakai "${category}" karena halaman uji memfilter per category.`,
    );
  }

  const payload = {
    category: category ?? baseline.category,
    basic: baseline.basic,
    position: baseline.position,
    expat: baseline.expat,
    home: baseline.home,
    hotskill: baseline.hotskill,
    total: baseline.total,
  };
  const summary =
    `category=${payload.category} basic=${payload.basic} position=${payload.position} ` +
    `expat=${payload.expat} home=${payload.home} hotskill=${payload.hotskill} total=${payload.total}`;

  const listRes = await fetch(
    `${cfg.baseUrl}/api/master-reguler-thp?search=${encodeURIComponent(name)}&per_page=200`,
    { headers: authHeaders },
  );
  if (!listRes.ok) {
    throw new Error(`ensureEmployeeRegulerThp: list THP failed: ${listRes.status} ${await listRes.text()}`);
  }
  const existing = await listRes.json();
  const record = (existing?.data ?? [])[0];
  if (record?.uuid) {
    const resetRes = await fetch(`${cfg.baseUrl}/api/master-reguler-thp/store`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ uuid: record.uuid, employee_uuid: record.employee_uuid, ...payload }),
    });
    if (!resetRes.ok) {
      throw new Error(`ensureEmployeeRegulerThp: reset failed: ${resetRes.status} ${await resetRes.text()}`);
    }
    console.log(`[ensureEmployeeRegulerThp] THP "${name}" di-set dari sheet DaftarGaji -> ${summary}`);
    return;
  }

  const empRes = await fetch(
    `${cfg.baseUrl}/api/employee-personal-info/employee-list?search=${encodeURIComponent(name)}&compact=1`,
    { headers: authHeaders },
  );
  if (!empRes.ok) {
    throw new Error(`ensureEmployeeRegulerThp: employee-list failed: ${empRes.status} ${await empRes.text()}`);
  }
  const emps = await empRes.json();
  const upper = name.toUpperCase();
  const emp = (emps?.data ?? []).find((e: { name?: string; uuid?: string }) =>
    e?.name?.toUpperCase().includes(upper),
  );
  if (!emp?.uuid) {
    throw new Error(`ensureEmployeeRegulerThp: employee "${name}" not found`);
  }

  const storeRes = await fetch(`${cfg.baseUrl}/api/master-reguler-thp/store`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ employee_uuid: emp.uuid, ...payload }),
  });
  if (!storeRes.ok) {
    throw new Error(`ensureEmployeeRegulerThp: store failed: ${storeRes.status} ${await storeRes.text()}`);
  }
  console.log(`[ensureEmployeeRegulerThp] THP "${name}" dibuat dari sheet DaftarGaji -> ${summary}`);
}

/**
 * Hapus semua record master-prorate-others milik karyawan uji.
 * Dipakai agar test "Other Add" idempotent (guard duplikat di sisi frontend
 * menolak submit bila record periode yang sama masih ada).
 */
export async function deleteProrateOthersForEmployee(cfg: PayrollApiConfig, token: string, name: string): Promise<number> {
  const n = await deleteRecordsForEmployee(token, cfg, {
    searchUrl: "/api/master-prorate-others",
    deleteUrlPrefix: "/api/master-prorate-others/delete/",
  });
  console.log(`[deleteProrateOthersForEmployee] "${name}": ${n} record(s) deleted`);
  return n;
}

/** Cari uuid karyawan (cocokkan substring nama). */
export async function findEmployeeUuid(cfg: PayrollApiConfig, token: string, name: string): Promise<string | undefined> {
  const res = await fetch(
    `${cfg.baseUrl}/api/employee-personal-info/employee-list?search=${encodeURIComponent(name)}&compact=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`findEmployeeUuid: employee-list failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const list: Array<{ name?: string; uuid?: string }> = body?.data ?? [];
  const upper = name.toUpperCase();
  const emp = list.find((e) => e?.name?.toUpperCase().includes(upper));
  return emp?.uuid;
}

/**
 * Hapus data BFKJ milik karyawan uji untuk tahun tertentu.
 * Dipakai agar test "BFKJ Add" idempotent.
 */
export async function deleteBfkjForEmployee(cfg: PayrollApiConfig, token: string, name: string, year: number = 2026): Promise<number> {
  const uuid = await findEmployeeUuid(cfg, token, name);
  if (!uuid) return 0;
  const res = await fetch(`${cfg.baseUrl}/api/non-regular-salary-bfkj/delete/${year}/${uuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok || res.status === 404) {
    console.log(`[deleteBfkjForEmployee] "${name}" ${year}: ok`);
    return 1;
  }
  throw new Error(`deleteBfkjForEmployee: ${res.status} ${await res.text()}`);
}

/** Hapus data menu non-regular via DELETE /{path}/{year}/{uuid}; 404 dianggap ok. */
async function deleteNonRegularByYearUuid(
  cfg: PayrollApiConfig,
  token: string,
  name: string,
  path: string,
  tag: string,
  year: number = 2026,
): Promise<number> {
  const uuid = await findEmployeeUuid(cfg, token, name);
  if (!uuid) return 0;
  const res = await fetch(`${cfg.baseUrl}/api/${path}/delete/${year}/${uuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok || res.status === 404) {
    console.log(`[${tag}] "${name}" ${year}: ok`);
    return 1;
  }
  throw new Error(`${tag}: ${res.status} ${await res.text()}`);
}

export function deleteHometripForEmployee(cfg: PayrollApiConfig, token: string, name: string, year: number = 2026): Promise<number> {
  return deleteNonRegularByYearUuid(cfg, token, name, "non-regular-salary-hometrip", "deleteHometripForEmployee", year);
}

export function deleteAnnualLeaveForEmployee(cfg: PayrollApiConfig, token: string, name: string, year: number = 2026): Promise<number> {
  return deleteNonRegularByYearUuid(cfg, token, name, "non-regular-salary-annual-leave", "deleteAnnualLeaveForEmployee", year);
}

export function deleteMonthSalaryForEmployee(cfg: PayrollApiConfig, token: string, name: string, year: number = 2026): Promise<number> {
  return deleteNonRegularByYearUuid(cfg, token, name, "non-regular-salary-13th-month", "deleteMonthSalaryForEmployee", year);
}

export function deleteCompetencyForEmployee(cfg: PayrollApiConfig, token: string, name: string, year: number = 2026): Promise<number> {
  return deleteNonRegularByYearUuid(cfg, token, name, "non-regular-salary-competency", "deleteCompetencyForEmployee", year);
}

/** Hapus data custom (salary component dinamis) milik karyawan uji. */
export async function deleteCustomForEmployee(
  cfg: PayrollApiConfig,
  token: string,
  componentUuid: string,
  name: string,
  year: number = 2026,
): Promise<number> {
  const uuid = await findEmployeeUuid(cfg, token, name);
  if (!uuid) return 0;
  const res = await fetch(`${cfg.baseUrl}/api/salary-components/delete-calculation-data/${componentUuid}/${year}/${uuid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok || res.status === 404) {
    console.log(`[deleteCustomForEmployee] "${name}" ${year}: ok`);
    return 1;
  }
  throw new Error(`deleteCustomForEmployee: ${res.status} ${await res.text()}`);
}

/** Hapus custom benefit berdasarkan title (untuk idempotensi test custom benefit setting). */
export async function deleteCustomBenefitByTitle(
  cfg: PayrollApiConfig,
  token: string,
  title: string,
): Promise<number> {
  const listRes = await fetch(`${cfg.baseUrl}/api/custom-benefits?search=${encodeURIComponent(title)}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    throw new Error(`deleteCustomBenefitByTitle: list failed: ${listRes.status} ${await listRes.text()}`);
  }
  const body = await listRes.json();
  const records: Array<{ uuid: string; title?: string }> = body?.data ?? [];
  let deleted = 0;
  for (const rec of records) {
    if ((rec.title ?? "").toUpperCase() !== title.toUpperCase()) continue;
    const delRes = await fetch(`${cfg.baseUrl}/api/custom-benefits/delete/${rec.uuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok || delRes.status === 404) deleted++;
    else console.warn(`[deleteCustomBenefitByTitle] delete ${rec.uuid} -> ${delRes.status}`);
  }
  console.log(`[deleteCustomBenefitByTitle] "${title}": ${deleted} record(s) deleted`);
  return deleted;
}

/** Hapus custom deduction berdasarkan title (untuk idempotensi test custom deduction setting). */
export async function deleteCustomDeductionByTitle(
  cfg: PayrollApiConfig,
  token: string,
  title: string,
): Promise<number> {
  if (!title) return 0;
  const listRes = await fetch(`${cfg.baseUrl}/api/custom-deductions?search=${encodeURIComponent(title)}&per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    throw new Error(`deleteCustomDeductionByTitle: list failed: ${listRes.status} ${await listRes.text()}`);
  }
  const body = await listRes.json();
  const records: Array<{ uuid: string; title?: string }> = body?.data ?? [];
  let deleted = 0;
  for (const rec of records) {
    if ((rec.title ?? "").toUpperCase() !== title.toUpperCase()) continue;
    const delRes = await fetch(`${cfg.baseUrl}/api/custom-deductions/delete/${rec.uuid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok || delRes.status === 404) deleted++;
    else console.warn(`[deleteCustomDeductionByTitle] delete ${rec.uuid} -> ${delRes.status}`);
  }
  console.log(`[deleteCustomDeductionByTitle] "${title}": ${deleted} record(s) deleted`);
  return deleted;
}

/** Representasi item payroll-report untuk periode tertentu (dipakai helper Report KKP). */
export interface PayrollReportItem {
  uuid: string;
  report_type: string;
  period: string;
  interval?: string;
  status: string;
}

export interface ReportKkpCleanupSummary {
  payrollReports: number;
  trashedPayrollReports: number;
  jurnalMemos: number;
  paymentReceiptNotes: number;
  payrolls: number;
}

/**
 * Ambil record dari list endpoint (data bisa array, atau objek dengan kunci
 * numerik / paginator Laravel). `listSelector` opsional untuk response dengan
 * bentuk khusus (mis. /generate-payroll yang membungkus lagi di .data.data).
 */
async function fetchRawList(
  baseUrl: string,
  token: string,
  searchUrl: string,
  listSelector?: (body: unknown) => Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const sep = searchUrl.includes("?") ? "&" : "?";
  const listParams = new URLSearchParams({ per_page: "200", page: "1" });
  const res = await fetch(`${baseUrl}/api${searchUrl}${sep}${listParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`[cleanup] list ${searchUrl} -> ${res.status}, skipped`);
    return [];
  }
  const body = await res.json();
  if (listSelector) return listSelector(body);
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  if (body?.data && typeof body.data === "object") return Object.values(body.data);
  return [];
}

async function deletePeriodRecords(
  token: string,
  cfg: PayrollApiConfig,
  searchUrl: string,
  deleteUrl: (rec: Record<string, unknown>) => string | undefined,
  tag: string,
  listSelector?: (body: unknown) => Array<Record<string, unknown>>,
): Promise<number> {
  const records = await fetchRawList(cfg.baseUrl, token, searchUrl, listSelector);
  let deleted = 0;
  for (const rec of records) {
    const url = deleteUrl(rec);
    if (!url) continue;
    const delRes = await fetch(`${cfg.baseUrl}/api${url}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (delRes.ok || delRes.status === 404) deleted++;
    else console.warn(`[cleanup] delete ${tag} ${url} -> ${delRes.status} ${await delRes.text()}`);
  }
  return deleted;
}

/**
 * Bersihkan semua artefak periode Report KKP agar test rerun idempotent:
 * payroll-report (aktif + arsip), jurnal memo (/generate-moju), rekap bayar
 * (/payment-receipt-notes), dan payroll/payslip (/generate-payroll).
 */
export async function cleanupReportKkpPeriod(
  cfg: PayrollApiConfig,
  token: string,
  period: string,
): Promise<ReportKkpCleanupSummary> {
  const payrollReports = await deletePeriodRecords(
    token, cfg,
    `/payroll-reports/by-period/${period}`,
    (r) => `/payroll-reports/${r.uuid}`,
    "payroll-report",
  );
  const trashedPayrollReports = await deletePeriodRecords(
    token, cfg,
    `/payroll-reports/trashed-by-period/${period}`,
    (r) => `/payroll-reports/${r.uuid}`,
    "payroll-report-trashed",
  );
  const jurnalMemos = await deletePeriodRecords(
    token, cfg,
    `/generate-moju?period=${period}`,
    (r) => `/generate-moju/delete/${r.uuid ?? r.id}`,
    "jurnal-memo",
  );
  const paymentReceiptNotes = await deletePeriodRecords(
    token, cfg,
    `/payment-receipt-notes?period=${period}`,
    (r) => `/payment-receipt-notes/delete/${r.uuid}`,
    "payment-receipt-note",
  );
  const payrolls = await deletePeriodRecords(
    token, cfg,
    `/generate-payroll?period=${period}`,
    (r) => `/generate-payroll/delete/${r.uuid}`,
    "generate-payroll",
    (body) => {
      const nested = (body as { data?: { data?: unknown } })?.data?.data;
      if (Array.isArray(nested)) return nested;
      const data = (body as { data?: unknown })?.data;
      return Array.isArray(data) ? data : [];
    },
  );
  const summary = { payrollReports, trashedPayrollReports, jurnalMemos, paymentReceiptNotes, payrolls };
  console.log(`[cleanup] Report KKP period ${period}: ${JSON.stringify(summary)} record(s) deleted`);
  return summary;
}

/** Ambil daftar payroll-report untuk suatu periode (aktif, bukan arsip). */
export async function getPayrollReportsByPeriodApi(
  cfg: PayrollApiConfig,
  token: string,
  period: string,
): Promise<PayrollReportItem[]> {
  return (await fetchRawList(cfg.baseUrl, token, `/payroll-reports/by-period/${period}`)) as unknown as PayrollReportItem[];
}

export interface JurnalMemoCleanupSummary {
  jurnalMemos: number;
  trashedJurnalMemos: number;
  paymentReceiptNotes: number;
  payrolls: number;
}

/**
 * Bersihkan artefak periode Jurnal Memo agar test rerun idempotent: jurnal memo
 * (/generate-moju aktif + arsip), rekap bayar (/payment-receipt-notes), dan
 * payslip (/generate-payroll). CATATAN: payroll-report (/payroll-reports) TIDAK
 * dihapus karena generate Jurnal Memo bergantung pada snapshot Report KKP
 * (validity check di form memblokir submit bila report belum ada).
 */
export async function cleanupJurnalMemoPeriod(
  cfg: PayrollApiConfig,
  token: string,
  period: string,
): Promise<JurnalMemoCleanupSummary> {
  const jurnalMemos = await deletePeriodRecords(
    token, cfg,
    `/generate-moju?period=${period}`,
    (r) => `/generate-moju/delete/${r.uuid ?? r.id}`,
    "jurnal-memo",
  );
  const trashedJurnalMemos = await deletePeriodRecords(
    token, cfg,
    `/generate-moju/trashed?period=${period}`,
    (r) => `/generate-moju/delete/${r.uuid ?? r.id}`,
    "jurnal-memo-trashed",
  );
  const paymentReceiptNotes = await deletePeriodRecords(
    token, cfg,
    `/payment-receipt-notes?period=${period}`,
    (r) => `/payment-receipt-notes/delete/${r.uuid}`,
    "payment-receipt-note",
  );
  const payrolls = await deletePeriodRecords(
    token, cfg,
    `/generate-payroll?period=${period}`,
    (r) => `/generate-payroll/delete/${r.uuid}`,
    "generate-payroll",
    (body) => {
      const nested = (body as { data?: { data?: unknown } })?.data?.data;
      if (Array.isArray(nested)) return nested;
      const data = (body as { data?: unknown })?.data;
      return Array.isArray(data) ? data : [];
    },
  );
  const summary = { jurnalMemos, trashedJurnalMemos, paymentReceiptNotes, payrolls };
  console.log(`[cleanup] Jurnal Memo period ${period}: ${JSON.stringify(summary)} record(s) deleted`);
  return summary;
}
