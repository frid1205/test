import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { LoginPage } from "./pages/LoginPage";

const authFile = path.resolve(import.meta.dirname, ".auth", "user.json");

setup("authenticate", async ({ page }) => {
  console.log("[auth.setup] Logging in via UI to capture cookies and storageState...");
  const loginPage = new LoginPage(page);
  await loginPage.login("0000000", "PasswordSuperAdmin@Tecel67");

  const authDir = path.dirname(authFile);
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
  console.log("[auth.setup] Auth state (cookies & localStorage) saved to .auth/user.json");
});
