import { apiLogin, cleanupTestPayrollData, type PayrollApiConfig } from "./helpers/api";
import { runSqlCleanup } from "./helpers/db";
import { API_BASE_URL, CLEANUP_BEFORE_TEST, CLEANUP_MODE, UI_BASE_URL } from "./config";
import fs from "node:fs";
import path from "node:path";

const cfg: PayrollApiConfig = {
  baseUrl: API_BASE_URL,
  nik: "0000000",
  password: "PasswordSuperAdmin@Tecel67",
};

export default async function globalSetup(): Promise<void> {
  console.log("[globalSetup] login API...");
  const { token, user, profile } = await apiLogin(cfg);

  if (CLEANUP_BEFORE_TEST) {
    if (CLEANUP_MODE === "sql") {
      console.log("[globalSetup] cleanup data via SQL (database)...");
      await runSqlCleanup();
    } else {
      console.log("[globalSetup] cleanup data karyawan uji via API...");
      await cleanupTestPayrollData(cfg, token);
    }
  } else {
    console.log("[globalSetup] CLEANUP_BEFORE_TEST=false - data dibiarkan.");
  }

  console.log("[globalSetup] menulis storage state (auth)...");
  const authDir = path.resolve(import.meta.dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: UI_BASE_URL,
        localStorage: [
          { name: "token", value: token },
          { name: "user", value: JSON.stringify(user) },
          { name: "profile", value: JSON.stringify(profile) },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(authDir, "user.json"), JSON.stringify(storageState, null, 2));
  console.log("[globalSetup] done - data siap untuk test.");
}
