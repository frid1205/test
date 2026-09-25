import type { Download, Locator, Page } from "@playwright/test";

const DOWNLOAD_TIMEOUT = 120_000;
const EXCEL_FAILURE_TOAST = "Failed to generate Excel";

type DownloadResult =
  | { kind: "download"; value: Download }
  | { kind: "failure" };

export async function downloadExcelWithFailureDetection(
  page: Page,
  exportButton: Locator,
  savePath: string,
): Promise<void> {
  const downloadPromise = page
    .waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT })
    .then((value): DownloadResult => ({ kind: "download", value }));
  const failureToastPromise = page
    .getByText(EXCEL_FAILURE_TOAST, { exact: true })
    .waitFor({ state: "visible", timeout: DOWNLOAD_TIMEOUT })
    .then((): DownloadResult => ({ kind: "failure" }));

  await exportButton.click();
  const result = await Promise.race([downloadPromise, failureToastPromise]);
  if (result.kind === "failure") {
    throw new Error(`Excel download failed: ${EXCEL_FAILURE_TOAST}`);
  }

  const download = result.value;
  if (!download.suggestedFilename().toLowerCase().endsWith(".xlsx")) {
    throw new Error(`Unexpected download filename: ${download.suggestedFilename()}`);
  }
  await download.saveAs(savePath);
}