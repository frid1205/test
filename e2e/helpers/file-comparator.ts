import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface CellDifference {
  sheet: string;
  row: number; // 1-indexed Excel row
  colIndex: number; // 1-indexed Excel col
  colLetter: string; // e.g., 'A', 'B', 'C'
  columnHeader?: string;
  expectedValue: any;
  actualValue: any;
  message?: string;
}

export interface FileComparisonResult {
  fileName: string;
  isMatched: boolean;
  status: 'MATCHED' | 'DIFFERENT' | 'MISSING_IN_DOWNLOADED' | 'EXTRA_IN_DOWNLOADED' | 'ERROR';
  errorMessage?: string;
  sheetDifferences: string[];
  cellDifferences: CellDifference[];
}

export interface ComparisonReport {
  timestamp: string;
  expectedDir: string;
  downloadedDir: string;
  totalFilesExpected: number;
  totalFilesDownloaded: number;
  matchedFilesCount: number;
  differentFilesCount: number;
  missingFilesCount: number;
  extraFilesCount: number;
  results: FileComparisonResult[];
}

/**
 * Converts a 1-indexed column number to Excel column letter (e.g. 1 -> A, 27 -> AA)
 */
export function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter || 'A';
}

/**
 * Normalizes cell values to avoid false positive differences due to trailing decimals, whitespace, etc.
 */
export function normalizeValue(val: any): string {
  if (val === undefined || val === null) {
    return '';
  }
  let str = String(val).trim();

  // If numeric string or number, standardize float formatting if applicable
  if (typeof val === 'number') {
    // Format float with up to 4 decimals removing trailing zeroes
    return Number.isInteger(val) ? val.toString() : parseFloat(val.toFixed(4)).toString();
  }

  // Strip carriage returns
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return str;
}

/**
 * Compare two Excel (.xlsx, .xls) files
 */
export function compareExcelFiles(expectedFilePath: string, downloadedFilePath: string): FileComparisonResult {
  const fileName = path.basename(expectedFilePath);
  const result: FileComparisonResult = {
    fileName,
    isMatched: true,
    status: 'MATCHED',
    sheetDifferences: [],
    cellDifferences: [],
  };

  try {
    const expectedBuf = fs.readFileSync(expectedFilePath);
    const downloadedBuf = fs.readFileSync(downloadedFilePath);

    const expectedWb = XLSX.read(expectedBuf, { type: 'buffer' });
    const downloadedWb = XLSX.read(downloadedBuf, { type: 'buffer' });

    const expectedSheets = expectedWb.SheetNames;
    const downloadedSheets = downloadedWb.SheetNames;

    // Check sheets
    for (const sheetName of expectedSheets) {
      if (!downloadedSheets.includes(sheetName)) {
        result.sheetDifferences.push(`Sheet "${sheetName}" exists in expected file but missing in downloaded file.`);
        result.isMatched = false;
      }
    }
    for (const sheetName of downloadedSheets) {
      if (!expectedSheets.includes(sheetName)) {
        result.sheetDifferences.push(`Sheet "${sheetName}" exists in downloaded file but missing in expected file.`);
        result.isMatched = false;
      }
    }

    // Compare common sheets
    const commonSheets = expectedSheets.filter((s) => downloadedSheets.includes(s));

    for (const sheetName of commonSheets) {
      const expSheet = expectedWb.Sheets[sheetName];
      const downSheet = downloadedWb.Sheets[sheetName];

      const expData: any[][] = XLSX.utils.sheet_to_json(expSheet, { header: 1, defval: '' });
      const downData: any[][] = XLSX.utils.sheet_to_json(downSheet, { header: 1, defval: '' });

      const maxRows = Math.max(expData.length, downData.length);
      const headers = (expData[0] || []).map((h: any) => String(h || '').trim());

      for (let r = 0; r < maxRows; r++) {
        const expRow = expData[r] || [];
        const downRow = downData[r] || [];
        const maxCols = Math.max(expRow.length, downRow.length);

        for (let c = 0; c < maxCols; c++) {
          const expVal = normalizeValue(expRow[c]);
          const downVal = normalizeValue(downRow[c]);

          if (expVal !== downVal) {
            result.isMatched = false;
            const colLetter = getColumnLetter(c + 1);
            const colHeader = headers[c] || `Col ${c + 1}`;

            result.cellDifferences.push({
              sheet: sheetName,
              row: r + 1, // 1-indexed for Excel users
              colIndex: c + 1,
              colLetter,
              columnHeader: colHeader,
              expectedValue: expRow[c] !== undefined ? expRow[c] : '(empty)',
              actualValue: downRow[c] !== undefined ? downRow[c] : '(empty)',
            });
          }
        }
      }
    }

    if (!result.isMatched) {
      result.status = 'DIFFERENT';
    }
  } catch (err: any) {
    result.isMatched = false;
    result.status = 'ERROR';
    result.errorMessage = err.message || String(err);
  }

  return result;
}

/**
 * Compare all files in expectedDir against downloadedDir
 */
export function compareFolders(expectedDir: string, downloadedDir: string): ComparisonReport {
  const timestamp = new Date().toISOString();
  const expectedFiles = fs.existsSync(expectedDir)
    ? fs.readdirSync(expectedDir).filter((f) => !f.startsWith('.') && fs.statSync(path.join(expectedDir, f)).isFile())
    : [];
  const downloadedFiles = fs.existsSync(downloadedDir)
    ? fs.readdirSync(downloadedDir).filter((f) => !f.startsWith('.') && fs.statSync(path.join(downloadedDir, f)).isFile())
    : [];

  const results: FileComparisonResult[] = [];
  const processedDownloaded = new Set<string>();

  for (const expFile of expectedFiles) {
    const expPath = path.join(expectedDir, expFile);
    const downPath = path.join(downloadedDir, expFile);

    if (!fs.existsSync(downPath)) {
      results.push({
        fileName: expFile,
        isMatched: false,
        status: 'MISSING_IN_DOWNLOADED',
        sheetDifferences: [],
        cellDifferences: [],
        errorMessage: `File exists in expectedData folder but was NOT found in downloadedFile folder.`,
      });
      continue;
    }

    processedDownloaded.add(expFile);

    if (expFile.endsWith('.xlsx') || expFile.endsWith('.xls')) {
      results.push(compareExcelFiles(expPath, downPath));
    } else {
      // Text or binary compare fallback
      const expContent = fs.readFileSync(expPath, 'utf-8');
      const downContent = fs.readFileSync(downPath, 'utf-8');
      if (expContent === downContent) {
        results.push({
          fileName: expFile,
          isMatched: true,
          status: 'MATCHED',
          sheetDifferences: [],
          cellDifferences: [],
        });
      } else {
        results.push({
          fileName: expFile,
          isMatched: false,
          status: 'DIFFERENT',
          sheetDifferences: [],
          cellDifferences: [],
          errorMessage: 'Text content differs.',
        });
      }
    }
  }

  // Extra files in downloaded
  for (const downFile of downloadedFiles) {
    if (!processedDownloaded.has(downFile)) {
      results.push({
        fileName: downFile,
        isMatched: false,
        status: 'EXTRA_IN_DOWNLOADED',
        sheetDifferences: [],
        cellDifferences: [],
        errorMessage: `File found in downloadedFile folder but does NOT exist in expectedData folder.`,
      });
    }
  }

  const matched = results.filter((r) => r.status === 'MATCHED').length;
  const different = results.filter((r) => r.status === 'DIFFERENT').length;
  const missing = results.filter((r) => r.status === 'MISSING_IN_DOWNLOADED').length;
  const extra = results.filter((r) => r.status === 'EXTRA_IN_DOWNLOADED').length;

  return {
    timestamp,
    expectedDir,
    downloadedDir,
    totalFilesExpected: expectedFiles.length,
    totalFilesDownloaded: downloadedFiles.length,
    matchedFilesCount: matched,
    differentFilesCount: different,
    missingFilesCount: missing,
    extraFilesCount: extra,
    results,
  };
}

/**
 * Generates and writes detailed log files
 */
export function writeComparisonLog(report: ComparisonReport, outputDir: string): { logFilePath: string; latestLogPath: string } {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `compare_${dateStr}.log`;
  const logFilePath = path.join(outputDir, logFileName);
  const latestLogPath = path.join(outputDir, 'latest-diff.log');

  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push('                      FILE COMPARISON & DIFFERENCE REPORT                       ');
  lines.push('================================================================================');
  lines.push(`Generated At : ${report.timestamp}`);
  lines.push(`Expected Dir : ${report.expectedDir}`);
  lines.push(`Download Dir : ${report.downloadedDir}`);
  lines.push('--------------------------------------------------------------------------------');
  lines.push('SUMMARY:');
  lines.push(`  - Total Expected Files   : ${report.totalFilesExpected}`);
  lines.push(`  - Total Downloaded Files : ${report.totalFilesDownloaded}`);
  lines.push(`  - Matched Files          : ${report.matchedFilesCount}`);
  lines.push(`  - Different Files        : ${report.differentFilesCount}`);
  lines.push(`  - Missing in Downloaded  : ${report.missingFilesCount}`);
  lines.push(`  - Extra in Downloaded    : ${report.extraFilesCount}`);
  lines.push('================================================================================\n');

  const diffResults = report.results.filter((r) => r.status !== 'MATCHED');

  if (diffResults.length === 0) {
    lines.push('RESULT: ALL FILES MATCH PERFECTLY! No differences found.\n');
  } else {
    lines.push(`RESULT: FOUND ${diffResults.length} FILE(S) WITH DIFFERENCES / ISSUES:\n`);

    for (let i = 0; i < diffResults.length; i++) {
      const res = diffResults[i];
      lines.push(`[${i + 1}] File: ${res.fileName}`);
      lines.push(`    Status: ${res.status}`);

      if (res.errorMessage) {
        lines.push(`    Error / Note: ${res.errorMessage}`);
      }

      if (res.sheetDifferences.length > 0) {
        lines.push(`    Sheet Structure Differences:`);
        for (const sd of res.sheetDifferences) {
          lines.push(`      - ${sd}`);
        }
      }

      if (res.cellDifferences.length > 0) {
        lines.push(`    Cell Differences (Total: ${res.cellDifferences.length}):`);
        lines.push(`    ----------------------------------------------------------------------------`);
        lines.push(`    | Sheet | Row (Baris) | Col (Kolom) | Header Name | Expected | Actual (Downloaded) |`);
        lines.push(`    ----------------------------------------------------------------------------`);
        
        for (const cd of res.cellDifferences) {
          const colInfo = `${cd.colLetter} (Col ${cd.colIndex})`;
          const headerInfo = cd.columnHeader ? `"${cd.columnHeader}"` : '-';
          lines.push(
            `    | [Sheet: ${cd.sheet}] | Baris ${cd.row} | Kolom ${colInfo} | Header: ${headerInfo}`
          );
          lines.push(`      --> Expected : ${JSON.stringify(cd.expectedValue)}`);
          lines.push(`      --> Actual   : ${JSON.stringify(cd.actualValue)}`);
          lines.push(`    ----------------------------------------------------------------------------`);
        }
      }
      lines.push('\n');
    }
  }

  const fileContent = lines.join('\n');
  fs.writeFileSync(logFilePath, fileContent, 'utf-8');
  fs.writeFileSync(latestLogPath, fileContent, 'utf-8');

  return { logFilePath, latestLogPath };
}
