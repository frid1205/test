import { test, expect } from '@playwright/test';
import * as path from 'path';
import { compareFolders, writeComparisonLog } from './helpers/file-comparator';

const EXPECTED_DIR = path.resolve(import.meta.dirname, 'expectedData');
const DOWNLOADED_DIR = path.resolve(import.meta.dirname, 'downloadedFile');
const LOG_OUTPUT_DIR = path.resolve(import.meta.dirname, 'compare-reports');

test.describe('File Comparison - Downloaded vs Expected Reports', () => {
  test('Compare all Excel files and generate detailed diff log', async () => {
    console.log(`\n🔍 Memulai perbandingan file:`);
    console.log(`   Expected Folder   : ${EXPECTED_DIR}`);
    console.log(`   Downloaded Folder : ${DOWNLOADED_DIR}`);

    const report = compareFolders(EXPECTED_DIR, DOWNLOADED_DIR);
    const { logFilePath, latestLogPath } = writeComparisonLog(report, LOG_OUTPUT_DIR);

    console.log(`\n📊 Ringkasan Hasil Perbandingan:`);
    console.log(`   - Total Expected Files   : ${report.totalFilesExpected}`);
    console.log(`   - Total Downloaded Files : ${report.totalFilesDownloaded}`);
    console.log(`   - Matched Files          : ${report.matchedFilesCount}`);
    console.log(`   - Different Files        : ${report.differentFilesCount}`);
    console.log(`   - Missing in Downloaded  : ${report.missingFilesCount}`);
    console.log(`   - Extra in Downloaded    : ${report.extraFilesCount}`);
    console.log(`\n📝 Log detail tersimpan di:`);
    console.log(`   - ${logFilePath}`);
    console.log(`   - ${latestLogPath}\n`);

    if (report.differentFilesCount > 0 || report.missingFilesCount > 0 || report.extraFilesCount > 0) {
      const issueSummary: string[] = [];
      for (const item of report.results) {
        if (item.status !== 'MATCHED') {
          if (item.status === 'DIFFERENT') {
            issueSummary.push(
              `❌ [DIFFERENT] ${item.fileName} (${item.cellDifferences.length} sel berbeda, contoh: Baris ${item.cellDifferences[0]?.row} Kolom ${item.cellDifferences[0]?.colLetter} "${item.cellDifferences[0]?.columnHeader}" [Expected: ${item.cellDifferences[0]?.expectedValue}, Actual: ${item.cellDifferences[0]?.actualValue}])`
            );
          } else if (item.status === 'MISSING_IN_DOWNLOADED') {
            issueSummary.push(`⚠️ [MISSING] ${item.fileName} (ada di expectedData tapi tidak ada di downloadedFile)`);
          } else if (item.status === 'EXTRA_IN_DOWNLOADED') {
            issueSummary.push(`⚠️ [EXTRA] ${item.fileName} (ada di downloadedFile tapi tidak ada di expectedData)`);
          } else if (item.status === 'ERROR') {
            issueSummary.push(`💥 [ERROR] ${item.fileName}: ${item.errorMessage}`);
          }
        }
      }

      const failureMessage =
        `Ditemukan perbedaan pada hasil download (${report.differentFilesCount} file beda, ${report.missingFilesCount} missing, ${report.extraFilesCount} extra).\n` +
        `Cek log lengkap di: ${latestLogPath}\n\n` +
        issueSummary.join('\n');

      expect(report.results.filter((r) => r.status !== 'MATCHED').length, failureMessage).toBe(0);
    } else {
      expect(report.matchedFilesCount).toBe(report.totalFilesExpected);
    }
  });
});
