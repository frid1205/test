import fs from "node:fs";
import path from "node:path";

export const API = "https://telkomcel-s1.lumoshive.net/api";
export const UI = "https://telkomcel-s1.lumoshive.net";
export const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
export const EVIDENCE = "D:/Work/Telkomcel/Result/evidence";

export const SUPERADMIN = { nik: "0000000", password: "PasswordSuperAdmin@Tecel67" };
export const VP = { nik: "999999", password: "TelkomC3l2025", otp: "1" };
export const VP_ROLE_ID = 27;

export const catalog = JSON.parse(fs.readFileSync(path.join(HERE, "catalog.json"), "utf8"));
export const endpoints = JSON.parse(fs.readFileSync(path.join(HERE, "endpoints.json"), "utf8"));
export const roleBackup = JSON.parse(fs.readFileSync(path.join(HERE, "role27-perm-names.json"), "utf8"));

async function post(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Bearer ${token ?? "your-app-key"}`,
    },
    body: new URLSearchParams(body).toString(),
  });
  return res;
}

/** Login super admin (tanpa OTP). */
export async function loginSuperAdmin() {
  const res = await post(`${API}/api/login`, { app: "HRISAPPS", ...SUPERADMIN });
  const data = await res.json();
  if (!data.token) throw new Error(`superadmin login failed: ${JSON.stringify(data).slice(0, 300)}`);
  return data.token;
}

/** Login VP (Lestari) — perlu verifikasi OTP. */
export async function loginVP() {
  const res = await post(`${API}/api/login`, { app: "HRISAPPS", nik: VP.nik, password: VP.password });
  const step1 = await res.json();
  if (step1.token) return step1;
  if (!step1.requires_otp) throw new Error(`VP login failed: ${JSON.stringify(step1).slice(0, 300)}`);
  const res2 = await post(`${API}/api/sso-otp`, { nik: VP.nik, otp: VP.otp, sso_token: step1.sso_token });
  const step2 = await res2.json();
  if (!step2.token) throw new Error(`VP OTP failed: ${JSON.stringify(step2).slice(0, 300)}`);
  return step2;
}

export async function apiGet(token, p) {
  const res = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const txt = await res.text();
  let body;
  try { body = JSON.parse(txt); } catch { body = txt.slice(0, 300); }
  return { status: res.status, body };
}

/** /api/me → dipakai untuk storageState browser (access_menu terbaru). */
export async function fetchProfile(token) {
  const me = await apiGet(token, "/api/me");
  if (me.status !== 200) throw new Error(`/api/me failed: ${me.status}`);
  const profile = me.body;
  if (profile.profile_photo !== undefined) { profile.image = profile.profile_photo; delete profile.profile_photo; }
  if (profile.current_position !== undefined) { profile.position = profile.current_position; delete profile.current_position; }
  profile.position = profile.position || "-";
  return profile;
}

/** Set daftar permission role VP lewat API superadmin. */
export async function setVpPermissions(adminToken, permissionNames) {
  const body = new URLSearchParams();
  body.set("role_name", "Vice President");
  body.set("role_description", "Vice President");
  body.set("can_access_cms", "1");
  for (const p of permissionNames) body.append("permission[]", p);
  const res = await fetch(`${API}/api/roles/update/${VP_ROLE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Bearer ${adminToken}` },
    body: body.toString(),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`setVpPermissions failed ${res.status}: ${txt.slice(0, 300)}`);
  return true;
}

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
export function saveJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 1)); }
