# Playwright Flaky Test Prevention Guide

## 1. Tujuan

Dokumen ini adalah guideline untuk menjaga **Playwright automation test tetap stabil, repeatable, dan reliable**, terutama untuk automation project berbasis web application seperti HRIS.

Fokus utama:

- Mengurangi flaky test.
- Menghindari false failure.
- Membuat test dapat dijalankan berulang kali dengan hasil konsisten.
- Menjaga test tetap stabil saat dijalankan di CI/CD.
- Mendukung parallel execution.
- Mempermudah investigasi ketika test benar-benar gagal.
- Memisahkan masalah automation dengan bug aplikasi.

> **Prinsip utama:** jangan membuat test "PASS karena menunggu lebih lama". Buat test menunggu **kondisi yang benar**.

---

# 2. Apa Itu Flaky Test?

Flaky test adalah automation test yang hasilnya tidak konsisten walaupun code aplikasi dan test tidak berubah.

Contoh:

```text
Run 1  → PASS
Run 2  → PASS
Run 3  → FAIL
Run 4  → PASS
Run 5  → FAIL
```

Flaky test dapat disebabkan oleh:

- Timing / synchronization.
- API belum selesai.
- UI belum selesai rendering.
- Animation / transition.
- Locator tidak stabil.
- Test data saling bertabrakan.
- Test bergantung pada test lain.
- Parallel execution.
- Authentication/session.
- Environment yang tidak stabil.
- Race condition.
- Database belum selesai melakukan update.
- Assertion dilakukan terlalu cepat.

---

# 3. Prinsip Utama Playwright

Gunakan pola berikut:

```text
Stable Locator
       +
Auto-Waiting
       +
Web-First Assertion
       +
Reliable Test Data
       +
Test Isolation
       +
Proper Synchronization
       +
Trace / Screenshot / Video
       +
Controlled Environment
       =
Stable Automation Test
```

Playwright sudah memiliki banyak mekanisme auto-waiting. Karena itu, hindari membuat mekanisme waiting manual jika Playwright sudah menyediakan mekanisme yang sesuai.

---

# 4. Jangan Menggunakan `page.waitForTimeout()` sebagai Solusi Utama

## ❌ Hindari

```typescript
await page.waitForTimeout(3000);

await page.getByRole('button', { name: 'Submit' }).click();
```

Masalah:

- Tidak menjamin aplikasi sudah siap.
- 3 detik mungkin terlalu cepat.
- 3 detik mungkin terlalu lama.
- Membuat execution time semakin panjang.
- Flaky test tetap dapat terjadi.

## ✅ Gunakan Locator + Auto-Wait

```typescript
await page
  .getByRole('button', { name: 'Submit' })
  .click();
```

Playwright akan menunggu element memenuhi actionability requirements sebelum melakukan click.

---

# 5. Gunakan Web-First Assertions

Salah satu cara paling penting untuk menghindari flaky test adalah menggunakan assertion Playwright.

## ❌ Kurang baik

```typescript
const status = await page.locator('#status').textContent();

expect(status).toBe('Approved');
```

Jika UI belum selesai update, assertion dapat membaca value lama.

## ✅ Recommended

```typescript
await expect(
  page.locator('#status')
).toHaveText('Approved');
```

Playwright akan melakukan retry terhadap assertion sampai timeout tercapai.

Contoh lain:

```typescript
await expect(
  page.getByText('Request submitted successfully')
).toBeVisible();
```

---

# 6. Prioritas Locator yang Stabil

Gunakan locator yang merepresentasikan bagaimana user berinteraksi dengan aplikasi.

Recommended priority:

```text
1. getByRole()
2. getByLabel()
3. getByPlaceholder()
4. getByTestId()
5. getByText() jika text memang stabil
6. locator() dengan CSS
7. XPath sebagai pilihan terakhir
```

## Recommended

```typescript
await page.getByRole('button', { name: 'Save' }).click();
```

```typescript
await page.getByLabel('Employee Number').fill('EMP001');
```

```typescript
await page.getByTestId('submit-button').click();
```

## Hindari

```typescript
await page.locator('div:nth-child(3) > div:nth-child(2) > button').click();
```

atau:

```typescript
await page.locator('/html/body/div[2]/div[3]/button').click();
```

Locator berdasarkan posisi DOM sangat mudah rusak ketika UI berubah.

---

# 7. Gunakan `data-testid` untuk Element Penting

Untuk aplikasi yang sering berubah, `data-testid` sangat membantu.

Developer dapat menyediakan:

```html
<button data-testid="submit-button">
    Submit
</button>
```

Playwright:

```typescript
await page.getByTestId('submit-button').click();
```

Recommended untuk element penting seperti:

```text
Login button
Submit button
Save button
Delete button
Approve button
Reject button
Search input
Table
Status
Toast
Modal
```

---

# 8. Jangan Membuat Locator Terlalu Generik

## ❌

```typescript
await page.getByRole('button').first().click();
```

Jika ada banyak button, hasil dapat berubah ketika UI berubah.

## ❌

```typescript
await page.locator('button').nth(2).click();
```

Index dapat berubah.

## ✅

```typescript
await page.getByRole('button', { name: 'Approve' }).click();
```

Lebih spesifik dan mudah dibaca.

---

# 9. Gunakan Locator Chaining

Untuk table atau component yang memiliki banyak data, gunakan locator yang scoped.

Contoh:

```typescript
const employeeRow = page
  .getByRole('row')
  .filter({ hasText: 'EMP001' });

await employeeRow
  .getByRole('button', { name: 'Edit' })
  .click();
```

Ini lebih stabil daripada:

```typescript
await page.locator('table tbody tr:nth-child(3) button').click();
```

---

# 10. Jangan Bergantung pada Posisi Data

## ❌

```typescript
await page.locator('tbody tr').nth(0).click();
```

Data pertama dapat berubah.

## ✅

```typescript
const row = page
  .getByRole('row')
  .filter({ hasText: 'EMP001' });

await row.click();
```

Automation sebaiknya mencari **data yang memang dibutuhkan**, bukan data berdasarkan posisi.

---

# 11. Gunakan `expect` untuk Menunggu UI

## ❌

```typescript
await page.waitForTimeout(2000);

await page.locator('.status').click();
```

## ✅

```typescript
await expect(
  page.locator('.status')
).toBeVisible();

await page.locator('.status').click();
```

Contoh:

```typescript
await expect(
  page.getByText('Loading...')
).toBeHidden();

await expect(
  page.getByText('Employee created successfully')
).toBeVisible();
```

---

# 12. Jangan Menunggu Loading Secara Berlebihan

Tidak semua test membutuhkan:

```typescript
await page.waitForTimeout(5000);
```

Jika aplikasi memiliki loading indicator:

```typescript
await expect(
  page.getByTestId('loading')
).toBeHidden();
```

Kemudian lanjutkan assertion.

Namun, jika element target sendiri sudah memiliki auto-wait dan actionability yang benar, sering kali explicit loading wait tidak diperlukan.

---

# 13. API dan Asynchronous Processing

Untuk aplikasi HRIS, beberapa action dapat melibatkan:

```text
User Action
    ↓
Frontend
    ↓
API
    ↓
Backend Processing
    ↓
Database
    ↓
Notification / Workflow
    ↓
Frontend Update
```

Jangan mengasumsikan:

```text
Click → langsung UI berubah
```

Jika action menyebabkan API request tertentu, tunggu response yang memang relevan.

Contoh:

```typescript
const responsePromise =
  page.waitForResponse(response =>
    response.url().includes('/api/employees') &&
    response.request().method() === 'POST' &&
    response.ok()
  );

await page.getByRole('button', { name: 'Save' }).click();

await responsePromise;
```

Kemudian validasi UI:

```typescript
await expect(
  page.getByText('Employee created successfully')
).toBeVisible();
```

> Gunakan `waitForResponse()` berdasarkan request yang memang relevan, bukan untuk setiap action secara otomatis.

---

# 14. Jangan Menunggu API dengan URL yang Terlalu Generik

## ❌

```typescript
await page.waitForResponse('**/api/**');
```

Aplikasi mungkin memiliki banyak request.

Akibatnya test dapat menunggu request yang salah.

## ✅

Gunakan endpoint dan method yang spesifik:

```typescript
await page.waitForResponse(response =>
  response.url().includes('/api/employees') &&
  response.request().method() === 'POST' &&
  response.ok()
);
```

---

# 15. Gunakan API untuk Test Data Setup Jika Memungkinkan

Untuk UI automation, jangan selalu membuat seluruh precondition melalui UI.

Contoh buruk:

```text
Login
 ↓
Open Personal
 ↓
Add Personal
 ↓
Fill 10 fields
 ↓
Save
 ↓
Open Employee
 ↓
Create Employee
 ↓
Open Request
 ↓
Test feature
```

Test menjadi panjang dan memiliki terlalu banyak titik kegagalan.

Lebih baik:

```text
API / Fixture
 ↓
Prepare Employee
 ↓
Prepare Required Data
 ↓
Login
 ↓
Test Feature via UI
 ↓
Verify Result
```

Contoh:

```typescript
await request.post('/api/employees', {
  data: employeeData
});
```

Kemudian test UI.

---

# 16. Gunakan Unique Test Data

Jangan menggunakan data yang sama untuk seluruh test.

## ❌

```typescript
const employeeNumber = 'EMP001';
```

Jika test berjalan parallel:

```text
Test A → Update EMP001
Test B → Delete EMP001
Test C → Verify EMP001
```

Hasil dapat random.

## ✅

Gunakan unique data:

```typescript
const employeeNumber =
  `EMP-${Date.now()}`;
```

Atau:

```typescript
import { randomUUID } from 'crypto';

const employeeNumber =
  `EMP-${randomUUID()}`;
```

---

# 17. Test Data Harus Diisolasi

Setiap test idealnya memiliki data sendiri.

Contoh:

```text
Test Personal Edit
 → PERSONAL-A

Test Employee Edit
 → EMPLOYEE-B

Test Employee Delete
 → EMPLOYEE-C
```

Hindari:

```text
Test A ─┐
Test B ─┼→ EMP001
Test C ─┘
```

Jika salah satu test mengubah data, test lain dapat terkena dampaknya.

---

# 18. Gunakan Fixtures untuk Test Data

Playwright fixtures dapat digunakan untuk menyiapkan data secara konsisten.

Contoh konsep:

```typescript
test('edit employee', async ({
  page,
  employee
}) => {

  await page.goto('/employees');

  await page.getByText(employee.number).click();

  await page.getByRole('button', {
    name: 'Edit'
  }).click();

});
```

Fixture dapat menangani:

- Authentication.
- Test data.
- API setup.
- Cleanup.
- Common page objects.

---

# 19. Test Harus Independent

Jangan membuat test seperti:

```text
Test 1 → Create Employee
Test 2 → Edit Employee dari Test 1
Test 3 → Delete Employee dari Test 1
```

Jika Test 1 gagal, Test 2 dan Test 3 ikut gagal.

Lebih baik:

```text
Test 1 → Setup Employee A → Create → Verify
Test 2 → Setup Employee B → Edit → Verify
Test 3 → Setup Employee C → Delete → Verify
```

---

# 20. Gunakan Browser Context untuk Isolation

Playwright menyediakan browser context yang terisolasi.

Konsep:

```text
Browser
│
├── Context A
│   └── Test A
│
├── Context B
│   └── Test B
│
└── Context C
    └── Test C
```

Isolation membantu mencegah:

- Cookie conflict.
- Session conflict.
- Local storage conflict.
- Authentication conflict.

---

# 21. Authentication State

Jika login UI bukan fokus test, gunakan authentication state.

Contoh konsep:

```typescript
test.use({
  storageState: 'playwright/.auth/admin.json'
});
```

Kemudian test dapat langsung masuk ke halaman yang diperlukan.

Dedicated test tetap dibuat untuk:

```text
Login
Logout
Invalid login
Authentication
Authorization
```

Dengan demikian kegagalan login tidak menyebabkan seluruh suite gagal.

---

# 22. Role-Based Authentication

Untuk HRIS yang memiliki role berbeda, buat authentication state sesuai kebutuhan.

Contoh:

```text
playwright/.auth/
├── admin.json
├── employee.json
├── supervisor.json
└── superadmin.json
```

Gunakan hanya role yang diperlukan oleh test.

Contoh:

```typescript
test.use({
  storageState: 'playwright/.auth/admin.json'
});
```

---

# 23. Jangan Hardcode Environment

Gunakan environment variable.

## ❌

```typescript
await page.goto(
  'https://staging.example.com'
);
```

## ✅

```typescript
const baseUrl =
  process.env.BASE_URL;

await page.goto(baseUrl);
```

Contoh:

```bash
BASE_URL=https://staging.example.com
```

Environment dapat dibedakan:

```text
local
development
staging
UAT
production
```

---

# 24. Hindari Test yang Bergantung pada Current Date

Date-related test sangat mudah menjadi flaky.

Contoh buruk:

```typescript
await expect(
  page.getByText('11/09/2026')
).toBeVisible();
```

Jika test dijalankan pada tanggal berbeda, test gagal.

Gunakan test data dengan tanggal yang dikontrol.

Untuk requirement yang memang bergantung pada current date, gunakan pendekatan yang dapat mengontrol waktu atau generate tanggal secara dinamis.

---

# 25. Timezone Harus Konsisten

Untuk aplikasi yang digunakan di Indonesia, pastikan test dan environment memiliki timezone yang konsisten jika tanggal/waktu menjadi bagian dari assertion.

Contoh:

```text
Asia/Jakarta
```

Perhatikan kasus:

```text
23:30 WIB
   ↓
UTC conversion
   ↓
Next day
```

Masalah timezone dapat menyebabkan:

- Date filter salah.
- Attendance date salah.
- Overtime date salah.
- Payroll period salah.
- WFH date salah.

---

# 26. Hindari Assertion yang Terlalu Bergantung pada UI Implementation

## ❌

```typescript
await expect(
  page.locator('div:nth-child(4)')
).toHaveText('Approved');
```

## ✅

```typescript
await expect(
  page.getByTestId('request-status')
).toHaveText('Approved');
```

Assertion harus fokus pada behavior atau business result.

---

# 27. Validasi Business Result

Jangan hanya menguji apakah button dapat di-click.

## ❌

```typescript
await page
  .getByRole('button', { name: 'Approve' })
  .click();

await expect(
  page.getByRole('button', { name: 'Approve' })
).toBeVisible();
```

Ini tidak membuktikan approval berhasil.

## ✅

```typescript
await page
  .getByRole('button', { name: 'Approve' })
  .click();

await expect(
  page.getByTestId('request-status')
).toHaveText('Approved');
```

Flow:

```text
Action
  ↓
Processing
  ↓
Business Result
  ↓
Assertion
```

---

# 28. Hindari `force: true` Tanpa Alasan

## ❌

```typescript
await page
  .getByRole('button', { name: 'Save' })
  .click({ force: true });
```

`force: true` dapat melewati sebagian actionability checks.

Jika test membutuhkan `force: true`, investigasi dulu:

- Apakah element tertutup overlay?
- Apakah element belum visible?
- Apakah locator salah?
- Apakah animation belum selesai?
- Apakah UI memang memiliki masalah?

Jangan menggunakan `force: true` hanya supaya test PASS.

---

# 29. Jangan Menggunakan `networkidle` sebagai Solusi Universal

Hindari pola:

```typescript
await page.waitForLoadState('networkidle');
```

sebagai satu-satunya mekanisme synchronization untuk setiap halaman.

Aplikasi modern dapat memiliki:

- WebSocket.
- Polling.
- Background request.
- Analytics.
- Notification service.

Akibatnya network tidak pernah benar-benar idle.

Lebih baik menunggu kondisi yang memang diperlukan:

```typescript
await expect(
  page.getByTestId('employee-table')
).toBeVisible();
```

atau menunggu response API tertentu jika memang relevan.

---

# 30. Handle Modal / Dialog Secara Deterministic

Untuk dialog browser:

```typescript
page.on('dialog', async dialog => {
  await dialog.accept();
});
```

Namun sebaiknya event handler dipasang sebelum action yang memicu dialog.

Untuk modal HTML:

```typescript
await expect(
  page.getByRole('dialog')
).toBeVisible();

await page
  .getByRole('dialog')
  .getByRole('button', { name: 'Confirm' })
  .click();
```

---

# 31. Handle Toast / Notification dengan Benar

Toast sering muncul sebentar.

## ❌

```typescript
await page.waitForTimeout(1000);

expect(
  await page.locator('.toast').textContent()
).toContain('Success');
```

## ✅

```typescript
await expect(
  page.getByRole('alert')
).toContainText('Success');
```

Playwright akan melakukan retry terhadap assertion.

---

# 32. Jangan Membuat Test Terlalu Panjang

Test yang terlalu panjang memiliki terlalu banyak titik kegagalan.

## ❌

```text
Login
Create Personal
Create Employee
Create Department
Create Position
Create Policy
Create Request
Approve Request
Edit Request
Delete Request
Verify Report
```

Jika gagal di akhir, sulit mengetahui root cause.

Lebih baik pecah berdasarkan business capability:

```text
Personal Test
Employee Test
Department Test
Policy Test
Request Test
Approval Test
Report Test
```

---

# 33. Page Object Model

Untuk project yang besar, gunakan Page Object Model.

Contoh:

```text
pages/
├── LoginPage.ts
├── EmployeePage.ts
├── PersonalPage.ts
├── DepartmentPage.ts
├── LeavePage.ts
├── WfhPage.ts
└── PayrollPage.ts
```

Contoh:

```typescript
export class EmployeePage {

  constructor(private page: Page) {}

  async open() {
    await this.page.goto('/employees');
  }

  async search(employeeNumber: string) {
    await this.page
      .getByPlaceholder('Search')
      .fill(employeeNumber);

    await this.page.keyboard.press('Enter');
  }

  async edit(employeeNumber: string) {
    const row = this.page
      .getByRole('row')
      .filter({ hasText: employeeNumber });

    await row
      .getByRole('button', { name: 'Edit' })
      .click();
  }
}
```

Page Object sebaiknya berisi interaction dengan page, bukan seluruh business assertion.

---

# 34. Gunakan Helper yang Meaningful

Buat helper berdasarkan behavior.

## Kurang baik

```typescript
clickButton('#btn1');
wait(3000);
clickInput('#input1');
```

## Lebih baik

```typescript
await employeePage.saveEmployee();

await employeePage.expectEmployeeSaved();
```

Helper harus membuat test lebih mudah dibaca, bukan menyembunyikan logic yang penting.

---

# 35. Retry Bukan Solusi Utama

Playwright memiliki retry untuk test yang gagal, tetapi retry tidak boleh digunakan untuk menutupi flaky test.

## Jangan berpikir:

```text
FAIL
 ↓
Retry
 ↓
PASS
 ↓
Berarti aman
```

Yang benar:

```text
FAIL
 ↓
Analyze
 ↓
Identify Root Cause
 ↓
Fix
 ↓
Run Again
```

Retry hanya menjadi **safety net**.

---

# 36. Gunakan Trace untuk Investigasi

Playwright Trace sangat berguna untuk flaky test.

Contoh configuration:

```typescript
use: {
  trace: 'on-first-retry'
}
```

Untuk investigasi yang lebih agresif:

```typescript
use: {
  trace: 'retain-on-failure'
}
```

Trace dapat membantu melihat:

- Action yang dilakukan.
- Locator.
- Screenshot.
- DOM snapshot.
- Network.
- Timing.
- Error.
- Browser state.

---

# 37. Screenshot dan Video Saat Failure

Recommended:

```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

Tujuannya:

```text
Test Failure
     ↓
Screenshot
     +
Video
     +
Trace
     +
Error Log
     ↓
Root Cause Analysis
```

Jangan hanya melihat:

```text
TimeoutError
```

Lihat kondisi UI pada saat failure.

---

# 38. Recommended Playwright Config

Contoh baseline:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({

  timeout: 30_000,

  expect: {
    timeout: 5_000
  },

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['html'],
    ['list']
  ],

  use: {
    baseURL: process.env.BASE_URL,

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'on-first-retry',

    headless: true
  }
});
```

> Nilai timeout, workers, dan retries harus disesuaikan dengan kemampuan environment CI/CD. Jangan memperbesar timeout hanya untuk menutupi masalah synchronization.

---

# 39. CI/CD Strategy

Automation sebaiknya dibagi berdasarkan kebutuhan.

Contoh:

```text
Pull Request
 └── Smoke Test

Merge
 └── Regression Test

Nightly
 └── Full Regression

Release
 └── Full Regression + Critical E2E
```

Jangan menjalankan seluruh regression suite untuk setiap perubahan kecil jika waktu execution menjadi terlalu lama.

---

# 40. Flaky Test Detection

Test yang dicurigai flaky harus dijalankan berkali-kali.

Contoh:

```text
Run 01 → PASS
Run 02 → PASS
Run 03 → FAIL
Run 04 → PASS
Run 05 → FAIL
```

Test tersebut perlu masuk daftar investigasi.

Buat tracking:

```text
Test Name
Feature
Failure Rate
Last Failure
Environment
Error
Root Cause
Status
```

Contoh:

```text
Employee Edit
Failure Rate: 15%
Root Cause: API synchronization
Status: Fix in progress
```

---

# 41. Jangan Menyembunyikan Flaky Test

Jangan langsung:

```typescript
test.skip();
```

atau:

```typescript
test.fixme();
```

hanya karena test sering gagal.

Gunakan status tersebut hanya jika memang ada alasan yang terdokumentasi.

Jika test flaky:

```text
FLAKY
 ↓
Investigate
 ↓
Root Cause
 ↓
Fix
 ↓
Validate
 ↓
Stable
```

---

# 42. Debugging Checklist

Jika test kadang PASS dan kadang FAIL, periksa:

### Synchronization

- [ ] Apakah menggunakan `page.waitForTimeout()`?
- [ ] Apakah assertion menggunakan `expect()` Playwright?
- [ ] Apakah API masih processing?
- [ ] Apakah UI masih rendering?
- [ ] Apakah ada animation?
- [ ] Apakah ada loading overlay?
- [ ] Apakah ada race condition?

### Locator

- [ ] Apakah locator stabil?
- [ ] Apakah menggunakan `nth()`?
- [ ] Apakah menggunakan selector berdasarkan DOM position?
- [ ] Apakah `data-testid` tersedia?
- [ ] Apakah locator terlalu generic?

### Test Data

- [ ] Apakah data unique?
- [ ] Apakah test lain menggunakan data yang sama?
- [ ] Apakah data di-cleanup?
- [ ] Apakah test berjalan parallel?

### Session

- [ ] Apakah authentication state benar?
- [ ] Apakah cookie/session conflict?
- [ ] Apakah role user benar?
- [ ] Apakah company/tenant context benar?

### Environment

- [ ] Apakah server stabil?
- [ ] Apakah API response lambat?
- [ ] Apakah database lambat?
- [ ] Apakah timezone konsisten?
- [ ] Apakah browser version konsisten?

### Evidence

- [ ] Screenshot tersedia?
- [ ] Video tersedia?
- [ ] Trace tersedia?
- [ ] Console log tersedia?
- [ ] Network/API error tersedia?

---

# 43. Root Cause Classification

Setiap flaky test sebaiknya dikategorikan.

```text
A. Automation Issue
B. Application Bug
C. Test Data Issue
D. Environment Issue
E. Infrastructure Issue
F. Requirement Issue
```

Contoh:

### Automation Issue

```text
Locator terlalu generic
```

### Application Bug

```text
API mengembalikan status 500
```

### Test Data Issue

```text
Test A dan Test B menggunakan employee yang sama
```

### Environment Issue

```text
Database response sangat lambat
```

### Infrastructure Issue

```text
CI runner kehabisan resource
```

---

# 44. Contoh Stable Test

Contoh test Employee Edit:

```typescript
import { test, expect } from '@playwright/test';

test(
  'should edit employee successfully',
  async ({ page }) => {

    const employeeNumber =
      `EMP-${Date.now()}`;

    // Prepare test data
    // Prefer API/fixture when possible

    await page.goto('/employees');

    // Search
    const searchInput =
      page.getByPlaceholder('Search Employee');

    await searchInput.fill(employeeNumber);

    // Find row by business data
    const row =
      page
        .getByRole('row')
        .filter({
          hasText: employeeNumber
        });

    await expect(row).toBeVisible();

    // Edit
    await row
      .getByRole('button', {
        name: 'Edit'
      })
      .click();

    // Update
    await page
      .getByLabel('Employment Status')
      .selectOption('active');

    await page
      .getByRole('button', {
        name: 'Save'
      })
      .click();

    // Verify business result
    await expect(
      page.getByTestId('employee-status')
    ).toHaveText('Active');
  }
);
```

Perhatikan:

```text
Tidak ada Thread.sleep
Tidak ada nth()
Tidak ada DOM position
Data unique
Locator meaningful
Web-first assertion
Business result divalidasi
```

---

# 45. Anti-Pattern yang Harus Dihindari

## ❌ Hard Sleep

```typescript
await page.waitForTimeout(5000);
```

## ❌ DOM Position

```typescript
page.locator('div:nth-child(3)');
```

## ❌ Generic Locator

```typescript
page.getByRole('button').first();
```

## ❌ Excessive Force

```typescript
click({ force: true });
```

## ❌ Shared Test Data

```text
Semua test → EMP001
```

## ❌ Test Dependency

```text
Test B bergantung pada Test A
```

## ❌ Blind Retry

```text
FAIL → Retry → PASS → Ignore
```

## ❌ Network Idle sebagai Universal Wait

```typescript
await page.waitForLoadState('networkidle');
```

---

# 46. Definition of Done — Stable Playwright Test

Sebuah test dapat dianggap stable jika:

- [ ] Dapat dijalankan secara individual.
- [ ] Tidak bergantung pada test lain.
- [ ] Tidak menggunakan `page.waitForTimeout()` sebagai synchronization utama.
- [ ] Menggunakan Playwright auto-waiting.
- [ ] Menggunakan web-first assertions.
- [ ] Locator stabil.
- [ ] Tidak bergantung pada `nth()`/posisi DOM tanpa alasan kuat.
- [ ] Test data isolated.
- [ ] Test dapat berjalan parallel.
- [ ] Authentication/session terkontrol.
- [ ] Environment terkontrol.
- [ ] Assertion memvalidasi business result.
- [ ] Screenshot tersedia ketika failure.
- [ ] Trace tersedia untuk investigasi.
- [ ] Test tidak membutuhkan retry untuk mendapatkan PASS.
- [ ] Dapat dijalankan berkali-kali dengan hasil konsisten.

---

# 47. Recommended Standard untuk Project Automation

Gunakan standard berikut sebagai baseline:

| Area | Standard |
|---|---|
| Wait | Playwright auto-wait |
| Fixed delay | Hindari `waitForTimeout()` |
| Assertion | Web-first `expect()` |
| Locator | Role / Label / TestId |
| DOM XPath | Last resort |
| Test data | Unique |
| Test isolation | Required |
| Parallel test | Supported |
| Authentication | Storage state / fixture |
| API setup | Recommended |
| Cleanup | Required |
| Retry | Safety net |
| Screenshot | On failure |
| Video | On failure |
| Trace | First retry / failure |
| CI/CD | Controlled environment |
| Failure analysis | Root cause based |

---

# 48. Recommended Project Structure

Struktur yang disarankan:

```text
automation/
│
├── tests/
│   ├── smoke/
│   ├── regression/
│   ├── employee/
│   ├── personal/
│   ├── department/
│   ├── leave/
│   ├── wfh/
│   ├── overtime/
│   ├── payroll/
│   └── esk/
│
├── pages/
│   ├── LoginPage.ts
│   ├── EmployeePage.ts
│   ├── PersonalPage.ts
│   ├── DepartmentPage.ts
│   ├── LeavePage.ts
│   ├── WfhPage.ts
│   ├── OvertimePage.ts
│   ├── PayrollPage.ts
│   └── EskPage.ts
│
├── fixtures/
│   ├── auth.fixture.ts
│   ├── employee.fixture.ts
│   └── test-data.fixture.ts
│
├── utils/
│   ├── api.ts
│   ├── test-data.ts
│   ├── date.ts
│   └── logger.ts
│
├── playwright.config.ts
│
└── playwright/
    └── .auth/
```

---

# 49. Recommended Workflow untuk QA

Saat menemukan flaky test:

```text
1. Reproduce
       ↓
2. Run test multiple times
       ↓
3. Collect Trace / Screenshot / Video
       ↓
4. Identify first failed action
       ↓
5. Check Locator
       ↓
6. Check Synchronization
       ↓
7. Check API
       ↓
8. Check Test Data
       ↓
9. Check Parallel Execution
       ↓
10. Check Environment
       ↓
11. Determine Root Cause
       ↓
12. Fix
       ↓
13. Run multiple times again
       ↓
14. Mark Stable
```

---

# 50. Kesimpulan

Untuk Playwright, cara terbaik menghilangkan flaky test bukan dengan menambahkan delay sebanyak mungkin.

Prioritas:

```text
1. Stable Locator
        ↓
2. Playwright Auto-Wait
        ↓
3. Web-First Assertion
        ↓
4. Proper API Synchronization
        ↓
5. Unique Test Data
        ↓
6. Test Isolation
        ↓
7. Stable Authentication
        ↓
8. Reliable Fixtures
        ↓
9. Trace / Screenshot / Video
        ↓
10. Root Cause Analysis
```

## Golden Rule

> **Jangan membuat automation test menunggu lebih lama. Buat automation test menunggu kondisi yang benar.**

Target akhir:

```text
Automation Test
      ↓
Run 1 → PASS
Run 2 → PASS
Run 3 → PASS
Run 4 → PASS
Run 5 → PASS
      ↓
Reliable
```

Bukan:

```text
Automation Test
      ↓
FAIL
      ↓
Retry
      ↓
PASS
      ↓
Dianggap selesai
```

**Stable automation test = test yang dapat dipercaya oleh QA dan developer sebagai indikator kualitas aplikasi.**
