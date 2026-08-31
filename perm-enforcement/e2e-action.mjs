/**
 * Uji end-to-end "action benar-benar bisa dijalankan" pada modul contoh
 * (Master Department). Alur: View+Add -> tambah data, View+Edit -> ubah data,
 * View+Delete -> hapus data. Setiap tahap diberi evidence screenshot.
 *
 * Assertion sengaja TIDAK bergantung pada teks di DOM (sumber flaky). Setiap
 * langkah diverifikasi dari dua sisi yang deterministik:
 *   1. status HTTP request tulis yang benar-benar dikirim halaman, dan
 *   2. state data yang dibaca ulang lewat API memakai token super admin.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { API, UI, catalog, loginSuperAdmin, loginVP, fetchProfile, setVpPermissions, ensureDir, saveJson, HERE, EVIDENCE } from "./lib.mjs";

const SLUG = "master-department";
const ROUTE = "/master-department";
const NAME_ADD = "QA PERM DEPT";
const NAME_EDIT = "QA PERM DEPT EDITED";
const WRITE_URL = /master-departments/;

const permsFor = (actions) => {
  const out = [];
  for (const m of catalog) for (const a of actions) out.push(`${m.slug}-${a}`);
  return out;
};

/** Baca data department bernama `name` langsung dari API (bukan dari DOM). */
const findDepartment = async (adminToken, name) => {
  const res = await fetch(`${API}/api/master-departments?search=${encodeURIComponent(name)}&per_page=50`, {
    headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  const list = body?.data?.data ?? body?.data ?? [];
  const arr = Array.isArray(list) ? list : [];
  return arr.find((d) => (d.dept_name || "").trim() === name) || null;
};

const cleanup = async (adminToken) => {
  for (const name of [NAME_ADD, NAME_EDIT]) {
    const found = await findDepartment(adminToken, name);
    if (found?.uuid) {
      await fetch(`${API}/api/master-departments/delete/${found.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      });
      console.log(`[cleanup] hapus sisa data "${name}"`);
    }
  }
};

const openAs = async (browser, adminToken, actions) => {
  await setVpPermissions(adminToken, permsFor(actions));
  const vp = await loginVP();
  const profile = await fetchProfile(vp.token);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  await ctx.addInitScript(([t, u, p]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", u);
    localStorage.setItem("profile", p);
  }, [vp.token, JSON.stringify(vp.user), JSON.stringify(profile)]);
  const page = await ctx.newPage();
  const writes = [];
  page.on("response", (res) => {
    if (WRITE_URL.test(res.url()) && res.request().method() !== "GET") {
      writes.push({ method: res.request().method(), url: res.url().replace(/^https?:\/\/[^/]+/, ""), status: res.status() });
    }
  });
  await page.goto(`${UI}${ROUTE}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-pulse'), null, { timeout: 25_000, polling: 300 })
    .catch(() => {});
  return { ctx, page, writes };
};

/** Ketik di kolom search lalu tunggu request list-nya selesai (bukan sleep tetap). */
const search = async (page, term) => {
  const box = page.getByPlaceholder(/search/i).first();
  await box.waitFor({ state: "visible", timeout: 20_000 });
  await box.fill(term);
  await page
    .waitForResponse((r) => WRITE_URL.test(r.url()) && r.request().method() === "GET" && r.url().includes("search="), { timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(600);
};

const run = async () => {
  const dir = ensureDir(path.join(EVIDENCE, "e2e-action-master-department"));
  const adminToken = await loginSuperAdmin();
  await cleanup(adminToken);

  const browser = await chromium.launch({ headless: true });
  const log = [];
  const shot = async (page, name) => {
    const f = path.join(dir, `${name}.png`);
    await page.screenshot({ path: f });
    return path.relative(EVIDENCE, f).split(path.sep).join("/");
  };

  // ── 1. View + Create -> tambah data ────────────────────────────────────────
  {
    const { ctx, page, writes } = await openAs(browser, adminToken, ["view", "create"]);
    const addBtn = page.getByRole("button", { name: /add data/i });
    const addVisible = await addBtn
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    await addBtn.click();
    const dialog = page.locator('[data-slot="dialog-content"]').last();
    await dialog.waitFor({ state: "visible", timeout: 20_000 });
    await dialog.locator("input:not([type=hidden]):not([type=checkbox])").first().fill(NAME_ADD);
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "ACTIVE", exact: true }).click();
    await shot(page, "01-add-form-filled");

    const submitted = page.waitForResponse((r) => WRITE_URL.test(r.url()) && r.request().method() === "POST", { timeout: 30_000 });
    await dialog.getByRole("button", { name: /^(create|save|simpan|submit)$/i }).first().click();
    const res = await submitted.catch(() => null);
    await page.waitForTimeout(1500);
    await search(page, NAME_ADD);

    const saved = await findDepartment(adminToken, NAME_ADD);
    log.push({
      step: "create-with-create-permission",
      addButtonVisible: addVisible,
      httpStatus: res ? res.status() : null,
      dataExistsAfter: !!saved,
      ok: addVisible && !!saved && res?.status() !== 403,
      httpCalls: writes,
      evidence: await shot(page, "02-add-result"),
    });
    await ctx.close();
  }

  // ── 2. View + Update -> ubah data ──────────────────────────────────────────
  {
    const { ctx, page, writes } = await openAs(browser, adminToken, ["view", "update"]);
    await search(page, NAME_ADD);
    const row = page.locator("table tbody tr", { hasText: NAME_ADD }).first();
    await row.waitFor({ state: "visible", timeout: 20_000 });
    await row.getByRole("button", { name: /edit/i }).click();
    const dialog = page.locator('[data-slot="dialog-content"]').last();
    await dialog.waitFor({ state: "visible", timeout: 20_000 });
    await dialog.locator("input:not([type=hidden]):not([type=checkbox])").first().fill(NAME_EDIT);
    await shot(page, "03-edit-form-filled");

    const submitted = page.waitForResponse((r) => WRITE_URL.test(r.url()) && r.request().method() !== "GET", { timeout: 30_000 });
    await dialog.getByRole("button", { name: /^(update|save|simpan|submit)$/i }).first().click();
    const res = await submitted.catch(() => null);
    await page.waitForTimeout(2000);

    const renamed = await findDepartment(adminToken, NAME_EDIT);
    const stillOld = await findDepartment(adminToken, NAME_ADD);
    // Notifikasi error muncul sebagai toast; cek elemen toast-nya, bukan seluruh
    // body (teks tabel bisa mengandung kata "failed" dan bikin false positive).
    const toasts = await page
      .locator('[data-slot="toast"], [role="status"], [role="alert"], .toast, [data-sonner-toast]')
      .allInnerTexts()
      .catch(() => []);
    const toastText = toasts.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    log.push({
      step: "update-with-update-permission",
      httpStatus: res ? res.status() : null,
      dataRenamed: !!renamed,
      dataUnchanged: !!stillOld,
      toastText,
      errorShownToUser: toastText.some((x) => /access denied|forbidden|403|gagal|failed|error/i.test(x)),
      ok: !!renamed && res?.status() !== 403,
      httpCalls: writes,
      evidence: await shot(page, "04-edit-result"),
    });
    await ctx.close();
  }

  // ── 3. View + Delete -> hapus data ─────────────────────────────────────────
  {
    const { ctx, page, writes } = await openAs(browser, adminToken, ["view", "delete"]);
    const existing = (await findDepartment(adminToken, NAME_EDIT)) ? NAME_EDIT : NAME_ADD;
    await search(page, existing);
    const row = page.locator("table tbody tr", { hasText: existing }).first();
    await row.waitFor({ state: "visible", timeout: 20_000 });
    await shot(page, "05-before-delete");
    await row.getByRole("button", { name: /delete/i }).click();

    const submitted = page.waitForResponse((r) => WRITE_URL.test(r.url()) && r.request().method() === "DELETE", { timeout: 30_000 });
    await page.getByRole("button", { name: /^(delete|hapus|yes|confirm)$/i }).last().click();
    const res = await submitted.catch(() => null);
    await page.waitForTimeout(2000);

    const gone = !(await findDepartment(adminToken, existing));
    log.push({
      step: "delete-with-delete-permission",
      httpStatus: res ? res.status() : null,
      dataDeleted: gone,
      ok: gone && res?.status() !== 403,
      httpCalls: writes,
      evidence: await shot(page, "06-after-delete"),
    });
    await ctx.close();
  }

  await browser.close();
  await cleanup(adminToken);
  saveJson(path.join(HERE, "result-e2e-action.json"), { slug: SLUG, log });
  console.log(JSON.stringify(log, null, 1));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
