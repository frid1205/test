/**
 * Sweep API: verifikasi backend benar-benar menolak action yang tidak diizinkan
 * role (403) dan meloloskan action yang diizinkan (bukan 403).
 *
 * Pemakaian: node api-sweep.mjs <passId>   (view | create | update | delete)
 */
import fs from "node:fs";
import path from "node:path";
import { API, catalog, endpoints, loginSuperAdmin, loginVP, setVpPermissions, saveJson, HERE } from "./lib.mjs";

const PASS = process.argv[2];
const ACTION_OF_PASS = { view: null, create: "create", update: "update", delete: "delete" };
if (!(PASS in ACTION_OF_PASS)) { console.error("passId: view|create|update|delete"); process.exit(1); }

const DUMMY = {
  "{uuid}": "00000000-0000-4000-8000-000000000000",
  "{id}": "999999999",
  "{year}": "1900",
  "{nik}": "0000000000",
  "{period}": "1900-01",
  "{costId}": "999999999",
  "{employee_uuid}": "00000000-0000-4000-8000-000000000000",
  "{benefitUuid}": "00000000-0000-4000-8000-000000000000",
  "{deductionUuid}": "00000000-0000-4000-8000-000000000000",
  "{type}": "regular",
};

const fill = (uri) => uri.replace(/\{[^}]+\}/g, (m) => DUMMY[m] ?? "999999999");

/** Endpoint modul yang TIDAK dilindungi middleware auto.permission (dicek terpisah). */
const EXTRA = {
  "approval-management": {
    update: { method: "POST", uri: "api/profile-edit-approval/approve/{uuid}", risky: true, unguarded: true },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(token, ep) {
  const url = `${API}/${fill(ep.uri)}`;
  const init = { method: ep.method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } };
  if (ep.method !== "DELETE" && ep.method !== "GET") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = "";
  }
  const res = await fetch(url, init);
  const txt = await res.text();
  let msg = txt.slice(0, 160);
  try { msg = JSON.stringify(JSON.parse(txt)).slice(0, 160); } catch { /* html */ }
  return { url, status: res.status, message: msg };
}

const run = async () => {
  const granted = ACTION_OF_PASS[PASS];
  const admin = await loginSuperAdmin();
  const actions = granted ? ["view", granted] : ["view"];
  const perms = [];
  for (const m of catalog) for (const a of actions) perms.push(`${m.slug}-${a}`);
  console.log(`[api:${PASS}] set permission (${actions.join("+")}) ...`);
  await setVpPermissions(admin, perms);
  const vp = await loginVP();

  const results = [];
  for (const m of catalog) {
    const eps = { ...(endpoints[m.slug] || {}) };
    for (const [a, e] of Object.entries(EXTRA[m.slug] || {})) if (!eps[a]) eps[a] = e;
    for (const action of ["create", "update", "delete"]) {
      let ep = eps[action];
      let viaCreate = false;
      // Banyak modul memakai endpoint POST .../store sebagai upsert: form Edit di UI
      // mengirim ke endpoint yang sama dengan Add. Untuk modul seperti itu, action
      // "update" diuji lewat endpoint create tersebut.
      if (!ep && action === "update" && eps.create) { ep = eps.create; viaCreate = true; }
      if (!ep) { results.push({ slug: m.slug, action, skipped: "no-endpoint" }); continue; }
      if (ep.risky && action === granted) {
        results.push({ slug: m.slug, action, endpoint: `${ep.method} ${ep.uri}`, viaCreate, skipped: "risky-positive" });
        continue;
      }
      await sleep(400); // hindari throttle 200 request/menit
      const r = await probe(vp.token, ep);
      results.push({ slug: m.slug, action, endpoint: `${ep.method} ${ep.uri}`, unguarded: !!ep.unguarded, viaCreate, ...r });
      const expect = action === granted ? "allow" : "deny";
      const ok = expect === "deny" ? r.status === 403 : r.status !== 403;
      console.log(`[api:${PASS}] ${m.slug.padEnd(26)} ${action.padEnd(6)} ${String(r.status).padEnd(4)} expect=${expect} ${ok ? "OK" : "<<< MISMATCH"}`);
    }
  }
  saveJson(path.join(HERE, `result-api-${PASS}.json`), { pass: PASS, granted, results });
  console.log(`[api:${PASS}] selesai`);
};

run().catch((e) => { console.error(e); process.exit(1); });
