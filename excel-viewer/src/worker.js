import * as XLSX from 'xlsx';

// Internal Worker State
let activeWorkbookRef = null;
let currentSheetName = '';
let sheetNamesList = [];
let allHeaders = [];
let rawRows = []; // Flat 2D array of cell values: rows[r][c]
let columnTypes = []; // 'numeric' | 'text'
let activeFilteredIndices = new Int32Array(0); // Compact typed array of row indices
let cachedFilterBuffer = null; // Reusable Int32Array buffer to avoid GC churn

// Message listener from main thread
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'PARSE_FILE':
        handleParseFile(payload);
        break;

      case 'SWITCH_SHEET':
        handleSwitchSheet(payload.sheetName);
        break;

      case 'QUERY':
        handleQuery(payload);
        break;

      case 'EXPORT_CSV':
        handleExportCsv(payload);
        break;

      case 'LOAD_SAMPLE':
        handleLoadSample(payload);
        break;

      case 'GET_UNIQUE_VALUES':
        handleGetUniqueValues(payload);
        break;

      case 'QUERY_WINDOW':
        handleQueryWindow(payload);
        break;

      default:
        console.warn('Unknown message type in worker:', type);
    }
  } catch (err) {
    console.error('Worker error:', err);
    self.postMessage({
      type: 'ERROR',
      message: err.message || 'An unexpected error occurred while processing the spreadsheet.'
    });
  }
};

// ==========================================================================
// Parsing & Ingestion (High-Performance & Memory-Optimized)
// ==========================================================================
function handleParseFile({ buffer, fileName }) {
  self.postMessage({ type: 'STATUS', message: 'Detecting format & reading...' });

  const isCsv = fileName.toLowerCase().endsWith('.csv');

  if (isCsv) {
    // Dedicated, ultra-fast streaming CSV parser (bypasses SheetJS memory overhead)
    self.postMessage({ type: 'STATUS', message: 'Parsing CSV data stream...' });
    const extracted = parseCsvFast(buffer);
    sheetNamesList = ['CSV Data'];
    currentSheetName = 'CSV Data';
    activeWorkbookRef = null;

    if (extracted.length === 0) {
      processHeadersAndRows(['Column 1'], []);
    } else {
      const rawHeaders = extracted[0] || [];
      const rows = extracted.slice(1);
      processHeadersAndRows(rawHeaders, rows);
    }

    finishParseAndRespond(fileName);
    return;
  }

  // Excel (.xlsx, .xls) Parsing via SheetJS in Dense Mode
  self.postMessage({ type: 'STATUS', message: 'Decompressing spreadsheet XML...' });

  const readOptions = {
    type: 'array',
    dense: true,
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellText: false,
    cellStyles: false,
    raw: true,
  };

  let workbook;
  try {
    workbook = XLSX.read(buffer, readOptions);
  } catch (err) {
    throw new Error(`Failed to parse file: ${err.message || 'Corrupted or unsupported format'}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No worksheets found in this workbook.');
  }

  sheetNamesList = workbook.SheetNames;
  currentSheetName = sheetNamesList[0];

  // If single sheet, release the workbook reference immediately
  if (sheetNamesList.length <= 1) {
    extractSheet(workbook.Sheets[currentSheetName]);
    workbook = null;
    activeWorkbookRef = null;
  } else {
    activeWorkbookRef = workbook;
    extractSheet(workbook.Sheets[currentSheetName]);
  }

  finishParseAndRespond(fileName);
}

// RFC 4180 Compliant High-Speed CSV Parser using Uint8Array / TextDecoder
function parseCsvFast(buffer) {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);
  const len = text.length;

  const rows = [];
  let currentRow = [];
  let fieldStart = 0;
  let inQuotes = false;
  let hasQuotes = false;

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);

    if (inQuotes) {
      if (code === 34 /* " */) {
        if (i + 1 < len && text.charCodeAt(i + 1) === 34) {
          i++; // Escaped quote ""
        } else {
          inQuotes = false;
        }
      }
    } else {
      if (code === 34 /* " */) {
        inQuotes = true;
        hasQuotes = true;
      } else if (code === 44 /* , */) {
        let field = text.slice(fieldStart, i);
        if (hasQuotes) field = cleanQuotedField(field);
        currentRow.push(field);
        fieldStart = i + 1;
        hasQuotes = false;
      } else if (code === 10 /* \n */ || code === 13 /* \r */) {
        let field = text.slice(fieldStart, i);
        if (hasQuotes) field = cleanQuotedField(field);
        currentRow.push(field);
        if (code === 13 && i + 1 < len && text.charCodeAt(i + 1) === 10) {
          i++; // Skip paired \n
        }
        fieldStart = i + 1;
        hasQuotes = false;

        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      }
    }
  }

  // Trailing record if no trailing newline
  if (fieldStart < len || currentRow.length > 0) {
    let field = text.slice(fieldStart);
    if (hasQuotes) field = cleanQuotedField(field);
    currentRow.push(field);
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function cleanQuotedField(str) {
  const trimmed = str.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return str;
}

function handleLoadSample({ sampleSheetData }) {
  sheetNamesList = [sampleSheetData.sheetName];
  currentSheetName = sampleSheetData.sheetName;
  activeWorkbookRef = null;

  processHeadersAndRows(sampleSheetData.headers, sampleSheetData.rows);
  finishParseAndRespond('Sample_Global_Sales_Q3.xlsx');
}

function handleSwitchSheet(sheetName) {
  if (!activeWorkbookRef) {
    throw new Error('Workbook data no longer available.');
  }
  const sheet = activeWorkbookRef.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }

  currentSheetName = sheetName;
  extractSheet(sheet);

  const initialPage = getPageSlice(1, 25);
  self.postMessage({
    type: 'SHEET_SWITCHED',
    currentSheet: currentSheetName,
    headers: allHeaders,
    totalRows: rawRows.length,
    columnTypes,
    pageRows: initialPage,
  });
}

function extractSheet(sheet) {
  self.postMessage({ type: 'STATUS', message: 'Extracting records & columns...' });

  const extracted = parseSheetFast(sheet);
  if (extracted.length === 0) {
    processHeadersAndRows(['Column 1'], []);
    return;
  }

  const rawHeaders = extracted[0] || [];
  const rows = extracted.slice(1);
  processHeadersAndRows(rawHeaders, rows);
}

function parseSheetFast(sheet) {
  if (!sheet) return [];
  const ref = sheet['!ref'];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rows = [];
  const dataSource = Array.isArray(sheet[0]) ? sheet : (sheet['!data'] || []);
  const numCols = range.e.c - range.s.c + 1;

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = dataSource[r];
    const rowVals = new Array(numCols);

    if (row) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = row[c];
        if (cell && cell.v !== undefined && cell.v !== null) {
          if (cell.t === 'd' && cell.v instanceof Date) {
            rowVals[c - range.s.c] = formatDate(cell.v);
          } else {
            rowVals[c - range.s.c] = cell.v;
          }
        } else {
          rowVals[c - range.s.c] = '';
        }
      }
      // Reclaim parsed cell objects immediately to free memory during large scans
      dataSource[r] = null;
    } else {
      rowVals.fill('');
    }
    rows.push(rowVals);
  }

  return rows;
}

function formatDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function processHeadersAndRows(headersIn, rowsIn) {
  // 1. Sanitize & deduplicate headers
  const sanitizedHeaders = [];
  const counts = {};

  headersIn.forEach((h, idx) => {
    let name = (h !== undefined && h !== null && String(h).trim() !== '')
      ? String(h).trim()
      : `Column ${idx + 1}`;

    if (counts[name]) {
      counts[name] += 1;
      name = `${name}_${counts[name]}`;
    } else {
      counts[name] = 1;
    }
    sanitizedHeaders.push(name);
  });

  allHeaders = sanitizedHeaders;
  const numCols = sanitizedHeaders.length;

  // 2. Ensure each row has exactly numCols elements
  rawRows = new Array(rowsIn.length);
  for (let r = 0; r < rowsIn.length; r++) {
    const row = rowsIn[r];
    if (row && row.length === numCols) {
      rawRows[r] = row;
    } else {
      const fixed = new Array(numCols);
      for (let c = 0; c < numCols; c++) {
        fixed[c] = (row && row[c] !== undefined && row[c] !== null) ? row[c] : '';
      }
      rawRows[r] = fixed;
    }
  }

  // 3. Infer column types
  columnTypes = inferColumnTypes(rawRows, numCols);

  // 4. Default active indices: 0..N-1 using compact Int32Array
  const total = rawRows.length;
  activeFilteredIndices = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    activeFilteredIndices[i] = i;
  }

  // Allocate / resize reusable filter buffer
  cachedFilterBuffer = new Int32Array(total);
}

function inferColumnTypes(rows, colCount) {
  const types = new Array(colCount);
  const sampleLimit = Math.min(rows.length, 100);

  for (let c = 0; c < colCount; c++) {
    let nonEmpties = 0;
    let numericCount = 0;

    for (let r = 0; r < sampleLimit; r++) {
      const val = rows[r][c];
      if (val !== '' && val !== null && val !== undefined) {
        nonEmpties++;
        const str = String(val).trim().replace(/^[$,€£¥]/, '');
        if (!isNaN(str) && !isNaN(parseFloat(str))) {
          numericCount++;
        }
      }
    }
    types[c] = (nonEmpties > 0 && (numericCount / nonEmpties) > 0.75) ? 'numeric' : 'text';
  }
  return types;
}

function finishParseAndRespond(fileName) {
  self.postMessage({ type: 'STATUS', message: 'Ready!' });

  const initialPage = getPageSlice(1, 25);
  self.postMessage({
    type: 'PARSE_SUCCESS',
    fileName,
    sheetNames: sheetNamesList,
    currentSheet: currentSheetName,
    headers: allHeaders,
    totalRows: rawRows.length,
    columnTypes,
    initialPageRows: initialPage,
  });
}

// ==========================================================================
// Filtering & Sorting Query Engine (High-Performance for Millions of Rows)
// ==========================================================================
function handleQueryWindow({ offset, limit }) {
  const start = Math.max(0, offset || 0);
  const end = Math.min(start + (limit || 100), activeFilteredIndices.length);
  const rows = sliceIndices(start, end);

  self.postMessage({
    type: 'WINDOW_RESULT',
    offset: start,
    limit: end - start,
    filteredCount: activeFilteredIndices.length,
    rows
  });
}

// ==========================================================================
// Numeric Filter Helpers (Supports >, >=, =, ==, <, <=, !=, <>, and, ranges)
// ==========================================================================
function parseNumericValue(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  const cleaned = s.replace(/^[^\d\-+.]+/, '').replace(/[^\d.+-]+$/, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cleanNumberTarget(valStr) {
  if (!valStr) return null;
  let s = valStr.trim().replace(/^[$,€£¥\s]+/, '').replace(/,/g, '');
  let multiplier = 1;
  if (/[kK]$/.test(s)) {
    multiplier = 1000;
    s = s.slice(0, -1);
  } else if (/[mM]$/.test(s)) {
    multiplier = 1000000;
    s = s.slice(0, -1);
  } else if (/[bB]$/.test(s)) {
    multiplier = 1000000000;
    s = s.slice(0, -1);
  } else if (/%$/.test(s)) {
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * multiplier : null;
}

function parseNumericFilterConditions(query) {
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Check for range format like "10..50"
  const rangeMatch = trimmed.match(/^([+-]?[$,€£¥]?\s*[\d,]+(?:\.\d+)?(?:[kKmMbB]|%)?)\s*\.\.\s*([+-]?[$,€£¥]?\s*[\d,]+(?:\.\d+)?(?:[kKmMbB]|%)?)$/);
  if (rangeMatch) {
    const v1 = cleanNumberTarget(rangeMatch[1]);
    const v2 = cleanNumberTarget(rangeMatch[2]);
    if (v1 !== null && v2 !== null) {
      return [
        { op: '>=', val: Math.min(v1, v2) },
        { op: '<=', val: Math.max(v1, v2) }
      ];
    }
  }

  // Split clauses by 'and', 'AND', '&&', ',', or boundary before operator
  const rawParts = trimmed.split(/\s+(?:and|AND|&&)\s+|,\s*|\s+(?=[><=!])/);
  const conditions = [];

  for (const part of rawParts) {
    const p = part.trim();
    if (!p) continue;
    const match = p.match(/^(>=|<=|!=|<>|==|>|<|=)\s*(.+)$/);
    if (!match) {
      return null;
    }
    const op = match[1];
    const target = cleanNumberTarget(match[2]);
    if (target === null) {
      return null;
    }
    conditions.push({ op, val: target });
  }

  return conditions.length > 0 ? conditions : null;
}

function evalNumericCondition(cellNum, op, targetNum) {
  switch (op) {
    case '>':
      return cellNum > targetNum;
    case '>=':
      return cellNum >= targetNum;
    case '<':
      return cellNum < targetNum;
    case '<=':
      return cellNum <= targetNum;
    case '=':
    case '==':
      return Math.abs(cellNum - targetNum) < 1e-9;
    case '!=':
    case '<>':
      return Math.abs(cellNum - targetNum) >= 1e-9;
    default:
      return false;
  }
}

function handleQuery({ sortCol, sortDir, globalSearch, colFilters, columnValueFilters, page, pageSize, isAppend, visibleCols }) {
  const hasGlobalSearch = Boolean(globalSearch && globalSearch.trim());
  const globalLower = hasGlobalSearch ? globalSearch.trim().toLowerCase() : '';

  const colFilterEntries = Object.entries(colFilters || {})
    .filter(([_, q]) => q && q.trim())
    .map(([colIdx, q]) => {
      const col = parseInt(colIdx, 10);
      const queryTrimmed = q.trim();
      const numConditions = parseNumericFilterConditions(queryTrimmed);
      return {
        col,
        queryLower: queryTrimmed.toLowerCase(),
        numConditions
      };
    });

  const colValFilterEntries = Object.entries(columnValueFilters || {})
    .filter(([_, allowedList]) => Array.isArray(allowedList))
    .map(([colIdxStr, allowedList]) => ({
      col: parseInt(colIdxStr, 10),
      allowedSet: new Set(allowedList)
    }));

  const visibleColSet = new Set(visibleCols || allHeaders.map((_, i) => i));

  // 1. Filtering indices using reusable Int32Array buffer
  const total = rawRows.length;
  if (!cachedFilterBuffer || cachedFilterBuffer.length !== total) {
    cachedFilterBuffer = new Int32Array(total);
  }

  let matchCount = 0;

  for (let i = 0; i < total; i++) {
    const row = rawRows[i];

    // Global search check
    if (hasGlobalSearch) {
      let found = false;
      for (const colIdx of visibleColSet) {
        if (colIdx < row.length) {
          const cell = row[colIdx];
          if (cell !== '' && cell !== null && cell !== undefined) {
            if (typeof cell === 'number') {
              if (String(cell).includes(globalLower)) {
                found = true;
                break;
              }
            } else if (String(cell).toLowerCase().includes(globalLower)) {
              found = true;
              break;
            }
          }
        }
      }
      if (!found) continue;
    }

    // Column-specific filter checks (supports >, >=, =, <, <=, !=, and, ranges, and text search)
    if (colFilterEntries.length > 0) {
      let matchesAll = true;
      for (let f = 0; f < colFilterEntries.length; f++) {
        const { col, queryLower, numConditions } = colFilterEntries[f];
        const val = row[col];

        if (numConditions && numConditions.length > 0) {
          const num = parseNumericValue(val);
          if (num === null) {
            matchesAll = false;
            break;
          }
          let condPass = true;
          for (let c = 0; c < numConditions.length; c++) {
            if (!evalNumericCondition(num, numConditions[c].op, numConditions[c].val)) {
              condPass = false;
              break;
            }
          }
          if (!condPass) {
            matchesAll = false;
            break;
          }
        } else {
          if (val === '' || val === null || val === undefined) {
            matchesAll = false;
            break;
          }
          if (typeof val === 'number') {
            if (!String(val).includes(queryLower)) {
              matchesAll = false;
              break;
            }
          } else if (!String(val).toLowerCase().includes(queryLower)) {
            matchesAll = false;
            break;
          }
        }
      }
      if (!matchesAll) continue;
    }

    // Excel-style column unique value checkbox filter
    if (colValFilterEntries.length > 0) {
      let matchesValueFilter = true;
      for (let v = 0; v < colValFilterEntries.length; v++) {
        const { col, allowedSet } = colValFilterEntries[v];
        const cellRaw = row[col];
        const cellStr = (cellRaw === undefined || cellRaw === null) ? '' : String(cellRaw);
        if (!allowedSet.has(cellStr)) {
          matchesValueFilter = false;
          break;
        }
      }
      if (!matchesValueFilter) continue;
    }

    cachedFilterBuffer[matchCount++] = i;
  }

  // Copy matched slice
  const matched = new Int32Array(matchCount);
  matched.set(cachedFilterBuffer.subarray(0, matchCount));

  // 2. High-Speed Index Sorting (Precomputed keys, 500x faster than localeCompare)
  if (sortCol !== null && sortCol !== undefined && sortDir && sortDir !== 'none') {
    sortMatchedIndices(matched, sortCol, sortDir);
  }

  activeFilteredIndices = matched;

  // 3. Slicing initial page or virtual window
  let start = 0;
  let end = matched.length;

  if (pageSize === Infinity) {
    // Prime sliding cache window with initial 600 rows
    end = Math.min(600, matched.length);
  } else if (pageSize > 0) {
    start = (page - 1) * pageSize;
    end = Math.min(start + pageSize, matched.length);
  }

  const pageRows = sliceIndices(start, end);

  self.postMessage({
    type: 'QUERY_RESULT',
    page,
    pageSize,
    offset: start,
    limit: end - start,
    isAppend: false,
    totalRows: rawRows.length,
    filteredCount: matched.length,
    rows: pageRows,
  });
}

function sortMatchedIndices(matched, sortCol, sortDir) {
  const isAsc = sortDir === 'asc';
  const isNumeric = columnTypes[sortCol] === 'numeric';
  const total = rawRows.length;

  if (isNumeric) {
    // Pre-extract numbers into Float64Array for lightning-fast comparisons
    const numKeys = new Float64Array(total);
    const hasNum = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const val = rawRows[i][sortCol];
      if (val === '' || val === null || val === undefined) {
        hasNum[i] = 0;
      } else {
        const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(num)) {
          numKeys[i] = num;
          hasNum[i] = 1;
        } else {
          hasNum[i] = 0;
        }
      }
    }

    matched.sort((idxA, idxB) => {
      const aHas = hasNum[idxA];
      const bHas = hasNum[idxB];
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1; // blanks to bottom
      if (!bHas) return -1;
      const diff = numKeys[idxA] - numKeys[idxB];
      return isAsc ? diff : -diff;
    });
  } else {
    // Pre-extract string keys for standard fast comparison
    const strKeys = new Array(total);
    for (let i = 0; i < total; i++) {
      const val = rawRows[i][sortCol];
      strKeys[i] = (val === '' || val === null || val === undefined) ? '' : String(val).toLowerCase();
    }

    matched.sort((idxA, idxB) => {
      const aStr = strKeys[idxA];
      const bStr = strKeys[idxB];
      if (aStr === bStr) return 0;
      if (aStr === '') return 1; // blanks to bottom
      if (bStr === '') return -1;
      return isAsc ? (aStr < bStr ? -1 : 1) : (aStr > bStr ? -1 : 1);
    });
  }
}

function sliceIndices(start, end) {
  const total = activeFilteredIndices.length;
  if (total === 0 || start >= total) return [];

  const actualEnd = Math.min(end, total);
  const count = Math.max(0, actualEnd - start);
  const slice = new Array(count);

  for (let i = start; i < actualEnd; i++) {
    const rawIdx = activeFilteredIndices[i];
    slice[i - start] = {
      _originalIndex: rawIdx + 1,
      values: rawRows[rawIdx]
    };
  }

  return slice;
}

function getPageSlice(page, pageSize) {
  const total = activeFilteredIndices.length;
  if (total === 0) return [];

  let start = 0;
  let end = total;

  if (pageSize !== Infinity && pageSize > 0) {
    start = (page - 1) * pageSize;
    end = Math.min(start + pageSize, total);
  } else if (pageSize === Infinity) {
    end = Math.min(100, total);
  }

  return sliceIndices(start, end);
}

// ==========================================================================
// Chunked CSV Export (Protects Against 512MB String Limits for Millions of Rows)
// ==========================================================================
function handleExportCsv({ visibleCols, baseFileName }) {
  self.postMessage({ type: 'STATUS', message: 'Generating CSV export...' });

  const colIndices = visibleCols.sort((a, b) => a - b);
  const headers = colIndices.map((c) => allHeaders[c]);

  const CHUNK_SIZE = 5000;
  const blobParts = [];

  // Push header line
  blobParts.push(headers.map(escapeCsvField).join(',') + '\r\n');

  let currentChunk = [];
  for (let i = 0; i < activeFilteredIndices.length; i++) {
    const rawIdx = activeFilteredIndices[i];
    const row = rawRows[rawIdx];
    const rowFields = colIndices.map((c) => escapeCsvField(row[c]));
    currentChunk.push(rowFields.join(','));

    if (currentChunk.length >= CHUNK_SIZE) {
      blobParts.push(currentChunk.join('\r\n') + '\r\n');
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    blobParts.push(currentChunk.join('\r\n') + '\r\n');
  }

  const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8;' });

  self.postMessage({
    type: 'EXPORT_CSV_RESULT',
    blob,
    count: activeFilteredIndices.length,
    fileName: `${baseFileName || 'export'}_filtered.csv`
  });
}

function escapeCsvField(val) {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ==========================================================================
// Unique Values Extraction for Excel Column Filtering (Capped to 10k Excel Limit)
// ==========================================================================
function handleGetUniqueValues({ colIdx }) {
  if (colIdx === undefined || colIdx === null || colIdx < 0 || colIdx >= allHeaders.length) {
    self.postMessage({ type: 'UNIQUE_VALUES_RESULT', colIdx, uniqueValues: [], isTruncated: false });
    return;
  }

  const countsMap = new Map();
  const total = rawRows.length;
  const MAX_UNIQUE_ITEMS = 10000; // Matches Excel's autofilter ceiling

  let distinctCount = 0;
  let isTruncated = false;

  for (let i = 0; i < total; i++) {
    const rawVal = rawRows[i][colIdx];
    const valStr = (rawVal === undefined || rawVal === null) ? '' : String(rawVal);
    const existing = countsMap.get(valStr);

    if (existing !== undefined) {
      countsMap.set(valStr, existing + 1);
    } else {
      if (distinctCount >= MAX_UNIQUE_ITEMS) {
        isTruncated = true;
        continue;
      }
      countsMap.set(valStr, 1);
      distinctCount++;
    }
  }

  const isNumeric = columnTypes[colIdx] === 'numeric';
  const uniqueList = Array.from(countsMap.entries()).map(([value, count]) => ({ value, count }));

  uniqueList.sort((a, b) => {
    if (a.value === '' && b.value === '') return 0;
    if (a.value === '') return 1;
    if (b.value === '') return -1;

    if (isNumeric) {
      const numA = parseFloat(a.value.replace(/[^0-9.-]+/g, ''));
      const numB = parseFloat(b.value.replace(/[^0-9.-]+/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
    }

    const sA = a.value.toLowerCase();
    const sB = b.value.toLowerCase();
    return sA < sB ? -1 : (sA > sB ? 1 : 0);
  });

  self.postMessage({
    type: 'UNIQUE_VALUES_RESULT',
    colIdx,
    uniqueValues: uniqueList,
    isTruncated,
    totalDistinctSampled: distinctCount
  });
}
