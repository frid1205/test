import { type Page, expect } from "@playwright/test";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await expect(this.page.getByRole("heading", { name: "Sign In" })).toBeVisible({ timeout: 20_000 });
  }

  async login(nik: string, password: string): Promise<void> {
    await this.goto();
    const inputs = this.page.locator("input");
    await inputs.nth(0).fill(nik);
    await inputs.nth(1).fill(password);
    await this.page.getByRole("button", { name: "Login" }).click();
    await this.page.waitForURL(/personal-information/, { timeout: 30_000 });
  }
}
