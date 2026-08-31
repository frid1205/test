/**
 * Mengembalikan permission role Vice President (id 27) ke kondisi sebelum
 * pengujian, sesuai backup role27-perm-names.json.
 */
import { loginSuperAdmin, setVpPermissions, roleBackup, apiGet, VP_ROLE_ID } from "./lib.mjs";

const token = await loginSuperAdmin();
console.log(`Restore ${roleBackup.length} permission ke role Vice President ...`);
await setVpPermissions(token, roleBackup);

const after = await apiGet(token, `/api/roles/edit/${VP_ROLE_ID}`);
const names = (after.body?.data?.role?.permissions || []).map((p) => p.name).sort();
const expected = [...roleBackup].sort();
const same = names.length === expected.length && names.every((n, i) => n === expected[i]);
console.log(`Permission sekarang: ${names.length}. Sesuai backup: ${same ? "YA" : "TIDAK"}`);
if (!same) {
  console.log("expected:", expected.join(" "));
  console.log("actual  :", names.join(" "));
  process.exit(1);
}
