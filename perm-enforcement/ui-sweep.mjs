/**
 * Sweep UI: buka seluruh menu HRIS sebagai user VP (Lestari) pada satu konfigurasi
 * permission, lalu catat tombol Add / Edit / Delete yang terlihat + screenshot.
 *
 * Pemakaian: node ui-sweep.mjs <passId>
 *   passId: view | create | update | delete | full
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { UI, catalog, loginSuperAdmin, loginVP, fetchProfile, setVpPermissions, ensureDir, saveJson, HERE, EVIDENCE, apiGet } from "./lib.mjs";

const LIST_ENDPOINTS = JSON.parse(fs.readFileSync(path.join(HERE, "list-endpoints.json"), "utf8"));

/**
 * Jumlah baris menurut API (bukan DOM). Dipakai untuk membedakan dua hal yang
 * di layar terlihat sama: tabel yang memang kosong vs tabel yang datanya belum
 * selesai dirender. Tanpa ini, hasil "0 baris" tidak bisa dipercaya.
 */
const apiRowCount = async (token, slug) => {
  const ep = LIST_ENDPOINTS[slug];
  if (!ep) return null;
  const r = await apiGet(token, `${ep}?per_page=5`).catch(() => null);
  if (!r || r.status !== 200) return null;
  const b = r.body;
  const total = b?.data?.total ?? b?.total ?? null;
  if (typeof total === "number") return total;
  const list = b?.data?.data ?? b?.data ?? b;
  return Array.isArray(list) ? list.length : null;
};

const PASS = process.argv[2];
const PASSES = {
  view:   { actions: ["view"],           title: "View only" },
  create: { actions: ["view", "create"], title: "View + Create" },
  update: { actions: ["view", "update"], title: "View + Update" },
  delete: { actions: ["view", "delete"], title: "View + Delete" },
  full:   { actions: ["view", "create", "update", "delete"], title: "Full access (baseline)" },
};
if (!PASSES[PASS]) { console.error("passId harus salah satu dari: " + Object.keys(PASSES).join(", ")); process.exit(1); }

const DETECT = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const inSidebar = (el) => !!el.closest("nav, aside, [data-sidebar]");
  const els = [...document.querySelectorAll('button, [role="button"], a[href]')].filter(vis).filter((el) => !inSidebar(el));

  // Signature ikon: lucide memakai class (lucide-pencil / lucide-trash-2),
  // react-icons hanya <svg> polos sehingga dicocokkan lewat path/points-nya.
  const sig = (el) => {
    const parts = [];
    el.querySelectorAll("svg").forEach((svg) => {
      parts.push(svg.getAttribute("class") || "");
      svg.querySelectorAll("path,polyline,line,rect,circle").forEach((p) => {
        parts.push(p.getAttribute("d") || "");
        parts.push(p.getAttribute("points") || "");
      });
    });
    return parts.join(" ");
  };
  const labelOf = (el) => [
    el.getAttribute("aria-label") || "",
    el.getAttribute("title") || "",
    (el.textContent || "").replace(/\s+/g, " ").trim(),
  ].filter(Boolean).join(" | ");

  const TEXT_ADD = /\b(add|tambah|create|new)\b/i;
  const TEXT_EDIT = /\b(edit|ubah)\b/i;
  const TEXT_DEL = /\b(delete|hapus|remove)\b/i;
  const ICON_ADD = /lucide-plus|lucide-circle-plus|lucide-square-plus/i;
  const ICON_EDIT = /lucide-pencil|lucide-square-pen|lucide-pen\b|M11 4H4a2 2/i;
  const ICON_DEL = /lucide-trash|3 6 5 6 21 6/i;

  const found = { add: [], edit: [], del: [] };
  for (const el of els) {
    const lb = labelOf(el);
    const sg = sig(el);
    const short = (lb || sg.slice(0, 40)).slice(0, 60);
    if (TEXT_ADD.test(lb) || (ICON_ADD.test(sg) && lb.length < 25)) found.add.push(short || "[icon:plus]");
    else if (TEXT_EDIT.test(lb) || ICON_EDIT.test(sg)) found.edit.push(short || "[icon:pencil]");
    else if (TEXT_DEL.test(lb) || ICON_DEL.test(sg)) found.del.push(short || "[icon:trash]");
  }

  const rows = document.querySelectorAll("table tbody tr");
  let dataRows = 0;
  let skeletonRows = 0;
  rows.forEach((tr) => {
    // Baris skeleton (loading) tidak boleh dihitung sebagai data; kalau masih ada
    // berarti tabel belum selesai fetch sehingga pembacaan dianggap belum stabil.
    if (tr.querySelector('[data-slot="skeleton"], .animate-pulse')) { skeletonRows++; return; }
    const txt = (tr.textContent || "").trim().toLowerCase();
    if (txt && !/no data|tidak ada data|belum ada data|loading/.test(txt) && tr.querySelectorAll("td").length > 1) dataRows++;
  });

  return {
    add: found.add.slice(0, 8),
    edit: found.edit.slice(0, 8),
    del: found.del.slice(0, 8),
    dataRows,
    skeletonRows,
    allButtons: [...new Set(els.map(labelOf).filter(Boolean))].slice(0, 60),
    bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
  };
};

/** Tunggu halaman selesai fetch: network idle + skeleton hilang. */
const settle = async (page) => {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[data-slot="skeleton"], .animate-pulse'), null, {
      timeout: 25_000,
      polling: 300,
    })
    .catch(() => {});
  await page.waitForTimeout(1200);
};

/** Dua pembacaan dianggap sama bila jumlah tombol & baris datanya identik. */
const sameReading = (a, b) =>
  a.add.length === b.add.length &&
  a.edit.length === b.edit.length &&
  a.del.length === b.del.length &&
  a.dataRows === b.dataRows &&
  a.skeletonRows === 0 &&
  b.skeletonRows === 0;

/**
 * Baca halaman berulang kali sampai dua pembacaan berturut-turut identik,
 * supaya hasil tidak bergantung pada timing render/fetch (sumber utama flaky).
 */
const readStable = async (page, maxAttempts = 5) => {
  let prev = await page.evaluate(DETECT);
  for (let i = 1; i <= maxAttempts; i += 1) {
    await page.waitForTimeout(1500);
    const cur = await page.evaluate(DETECT);
    if (sameReading(prev, cur)) return { ...cur, reads: i + 1, stable: true };
    prev = cur;
  }
  return { ...prev, reads: maxAttempts + 1, stable: false };
};

const run = async () => {
  const cfg = PASSES[PASS];
  const admin = await loginSuperAdmin();

  // Susun permission: setiap menu diberi action sesuai pass yang berjalan.
  const perms = [];
  for (const m of catalog) for (const a of cfg.actions) perms.push(`${m.slug}-${a}`);
  console.log(`[${PASS}] set ${perms.length} permission untuk role Vice President ...`);
  await setVpPermissions(admin, perms);

  const vp = await loginVP();
  const profile = await fetchProfile(vp.token);

  const outDir = ensureDir(path.join(EVIDENCE, `pass-${PASS}`));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  await ctx.addInitScript(([t, u, p]) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", u);
    localStorage.setItem("profile", p);
  }, [vp.token, JSON.stringify(vp.user), JSON.stringify(profile)]);

  const page = await ctx.newPage();
  page.on("pageerror", () => {});
  const results = [];

  const only = process.env.PERM_ONLY ? process.env.PERM_ONLY.split(",") : null;
  for (const m of catalog.filter((x) => !only || only.includes(x.slug))) {
    const rec = { slug: m.slug, name: m.name, module: m.module, route: m.route };
    try {
      await page.goto(`${UI}${m.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await settle(page);
      rec.finalUrl = page.url();
      let reading = await readStable(page);

      // Tabel kosong bisa berarti (a) data memang tidak ada, atau (b) render belum
      // selesai. Dibedakan lewat API; kalau API punya data tapi DOM kosong, halaman
      // di-reload dan dibaca ulang.
      rec.apiRows = await apiRowCount(vp.token, m.slug);
      for (let retry = 0; retry < 2 && reading.dataRows === 0 && (rec.apiRows ?? 0) > 0; retry += 1) {
        rec.reloadedOnEmpty = retry + 1;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
        await settle(page);
        reading = await readStable(page);
      }
      // Setelah reload masih kosong padahal API punya data => bukan race render,
      // melainkan halaman memfilter default (mis. periode berjalan).
      let emptyReason = null;
      if (reading.dataRows === 0) {
        if (rec.apiRows === null || rec.apiRows === undefined) emptyReason = "empty-unverified";
        else if (rec.apiRows > 0) emptyReason = "empty-on-default-filter";
        else emptyReason = "no-data-in-environment";
      }
      rec.emptyReason = emptyReason;
      Object.assign(rec, reading);
      const shot = path.join(outDir, `${m.slug}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      rec.evidence = path.relative(EVIDENCE, shot).split(path.sep).join("/");
    } catch (e) {
      rec.error = String(e).slice(0, 200);
    }
    console.log(
      `[${PASS}] ${m.slug.padEnd(26)} add=${(rec.add || []).length} edit=${(rec.edit || []).length} del=${(rec.del || []).length} rows=${rec.dataRows ?? "-"}/api:${rec.apiRows ?? "-"} reads=${rec.reads ?? "-"}${rec.reloadedOnEmpty ? " RELOADED" : ""}${rec.emptyReason === "empty-on-default-filter" ? " FILTERED-EMPTY" : ""}${rec.stable === false ? " UNSTABLE" : ""}${rec.error ? " ERR" : ""}`,
    );
    results.push(rec);
  }

  await browser.close();
  saveJson(path.join(HERE, `result-ui-${PASS}.json`), { pass: PASS, title: cfg.title, permissions: perms, results });
  console.log(`[${PASS}] selesai → result-ui-${PASS}.json`);
};

run().catch((e) => { console.error(e); process.exit(1); });
