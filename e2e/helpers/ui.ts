import { type Locator, type Page, expect } from "@playwright/test";

export async function chooseCombobox(
  page: Page,
  dialog: Locator,
  trigger: Locator,
  searchText: string,
  optionLabel: string,
  searchUrl?: string,
): Promise<void> {
  await trigger.click();
  const searchBox = page.getByPlaceholder("Search...").last();
  await searchBox.fill(searchText);
  // Combobox (CInput) me-render ulang daftar opsi setiap keystroke via fetch
  // (debounce 300ms) pada searchUrl. Tunggu response search selesai agar opsi
  // tidak ter-detach saat diklik.
  if (searchUrl) {
    await page.waitForResponse(
      (r) => r.url().includes(searchUrl) && r.url().includes("search=") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
  }
  const option = page.locator("[role=option]", { hasText: optionLabel }).last();
  await expect(option).toBeVisible({ timeout: 45_000 });
  await option.click();
  await expect(dialog.locator("button[role=combobox]").first()).toBeVisible();
}

export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function pickMonth(page: Page, trigger: Locator, month: string, year: string): Promise<void> {
  await trigger.click();
  // DatePicker (CInput type="month") me-render popover-nya sebagai portal berisi
  // dua <select> (bulan & tahun). Scope ke popover milik trigger via aria-controls
  // agar tidak mencocokkan combobox lain (filter tabel, employee selector, popover
  // field period lain yang ikut ter-mount).
  const contentId = await trigger.getAttribute("aria-controls");
  const popover = contentId
    ? page.locator(`[id="${contentId}"]`)
    : page.locator('[data-slot="popover-content"]').filter({ has: page.getByRole("option", { name: month }) });
  const monthSelect = popover
    .getByRole("combobox")
    .filter({ has: page.getByRole("option", { name: month }) });
  const yearSelect = popover
    .getByRole("combobox")
    .filter({ has: page.getByRole("option", { name: year }) });
  await expect(monthSelect).toBeVisible();
  await monthSelect.selectOption(String(MONTH_NAMES_ID.indexOf(month)));
  await yearSelect.selectOption(year);
}

export async function pickDate(page: Page, trigger: Locator, dateStr: string): Promise<void> {
  await trigger.click();
  const [year, month, day] = dateStr.split("-");
  const monthName = MONTH_NAMES_ID[Number(month) - 1];
  const monthSelect = page.getByRole("combobox", { name: "Choose the Month" });
  const yearSelect = page.getByRole("combobox", { name: "Choose the Year" });
  await expect(monthSelect).toBeVisible();
  await monthSelect.selectOption({ index: Number(month) - 1 });
  await yearSelect.selectOption({ label: year });
  const grid = page.getByRole("grid", { name: new RegExp(`${monthName} ${year}`) });
  await expect(grid).toBeVisible();
  await grid.getByRole("button", { name: new RegExp(`^\\S+\\s+${day}\\s+${monthName}\\s+${year}$`) }).click();
}

/**
 * Picker tanggal tunggal (grid berbahasa Indonesia, tanpa aria-label per hari).
 * Digunakan untuk "Date of Entry" di form Prorate.
 */
export async function pickDay(page: Page, trigger: Locator, dateStr: string): Promise<void> {
  await trigger.click();
  const [year, month, day] = dateStr.split("-");
  const monthSelect = page.getByRole("combobox", { name: "Choose the Month" });
  const yearSelect = page.getByRole("combobox", { name: "Choose the Year" });
  await expect(monthSelect).toBeVisible();
  await monthSelect.selectOption({ index: Number(month) - 1 });
  await yearSelect.selectOption({ label: year });
  const monthName = MONTH_NAMES_ID[Number(month) - 1];
  const grid = page.getByRole("grid", { name: new RegExp(`${monthName} ${year}`) });
  await expect(grid).toBeVisible();
  await grid.getByText(String(Number(day)), { exact: true }).click();
}

/**
 * Date range picker (grid & bulan berbahasa Inggris, numberOfMonths=2 sehingga
 * satu popover punya DUA dropdown "Choose the Month" - dipakai yang pertama).
 * Digunakan untuk "Period 80% Prorate" dan "Period 100% Prorate" di form Prorate.
 */
export async function pickRange(page: Page, trigger: Locator, fromStr: string, toStr: string): Promise<void> {
  await trigger.click();
  const [fy, fm, fd] = fromStr.split("-");
  const [, , td] = toStr.split("-");
  const monthSelect = page.getByRole("combobox", { name: "Choose the Month" }).first();
  const yearSelect = page.getByRole("combobox", { name: "Choose the Year" }).first();
  await expect(monthSelect).toBeVisible();
  await monthSelect.selectOption({ index: Number(fm) - 1 });
  await yearSelect.selectOption({ label: fy });
  const monthName = MONTH_NAMES_EN[Number(fm) - 1];
  const grid = page.getByRole("grid", { name: new RegExp(`${monthName} ${fy}`) });
  await expect(grid).toBeVisible();
  // Hari dipilih via aria-label berbulan (hindari sel spillover bulan lain).
  const dayButton = (d: number) =>
    grid.getByRole("button", { name: new RegExp(`${monthName} ${d}`) }).first();
  // dispatchEvent menghindari hover: gerakan mouse memicu onDayMouseEnter
  // (tempRange) yang me-render ulang grid terus-menerus.
  //
  // From bisa sudah ter-set otomatis oleh form (date_of_entry -> range 80%,
  // auto-advance 80%to+1 -> range 100%); jika trigger sudah menampilkan
  // tanggal, klik hanya hari akhir agar range terselesaikan dengan benar.
  const triggerText = (await trigger.innerText()).trim();
  if (triggerText === "" || triggerText === "Pick a date range") {
    await dayButton(Number(fd)).dispatchEvent("click");
  }
  await dayButton(Number(td)).dispatchEvent("click");
}

export async function chooseSelect(page: Page, trigger: Locator, optionLabel: string): Promise<void> {
  await trigger.click();
  const option = page.getByRole("option", { name: optionLabel }).last();
  await expect(option).toBeVisible();
  await option.click();
}

export async function submitAndWait(
  page: Page,
  dialog: Locator,
  buttonName: string,
  apiPath: string,
  _toastMessage: string,
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes(apiPath) && r.request().method() === "POST",
    { timeout: 90_000 },
  );
  await dialog.getByRole("button", { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`POST ${apiPath} -> ${response.status()}: ${body}`);
  }
  await expect(dialog).toBeHidden({ timeout: 120_000 });
}

export function currencyFormat(value: string | number): string {
  const num = Number(value);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyFormat(value: string | number): string {
  const num = Number(value);
  return num.toLocaleString("en-US");
}

export async function clickRowEdit(page: Page, employeeName: string): Promise<void> {
  const row = page.locator("tbody tr", { hasText: employeeName }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.getByRole("button", { name: "Edit" }).click();
}

/**
 * Wrapper div dari sebuah field di dalam dialog. Bekerja untuk dua struktur:
 * - label berbasis <label> yang teksnya bisa punya <span>*</span> (mis. "Period *"),
 * - span polos pada shared NonRegularMonthlyForm (mis. <span>Period</span>).
 * getByText dengan regex memilih elemen terkecil yang teksnya cocok,
 * sehingga hasilnya adalah elemen label/span (bukan div pembungkusnya).
 */
export function formField(dialog: Locator, label: string): Locator {
  return dialog
    .getByText(new RegExp(`^${label}(\\s+\\*|\\*|\\s)?$`))
    .first()
    .locator("..");
}

/**
 * Klik sel bulan di tabel non-regular (filter "yearly").
 * Untuk CUTAH / Competency / Custom, kolom Agu/Aug berada di td index 12.
 */
export async function clickMonthCell(row: Locator, cellIndex = 12): Promise<void> {
  await row.locator("td").nth(cellIndex).locator("[role=button]").click();
}
