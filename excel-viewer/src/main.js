import * as XLSX from 'xlsx';
import { sampleSheetData } from './sample-data.js';

// Application State
const state = {
  fileName: '',
  workbook: null,
  sheetNames: [],
  currentSheet: '',
  allHeaders: [], // Array of string header titles
  rawRows: [],    // Array of original row arrays
  columnTypes: [], // Inferred types per column
  visibleColumns: new Set(), // Set of column indices
  sortColumn: null, // Index of column currently sorted
  sortDirection: 'none', // 'asc' | 'desc' | 'none'
  globalSearch: '',
  columnFilters: {}, // Map of colIndex -> string query
  isFilterRowVisible: true,
  pageSize: 25,
  currentPage: 1,
  filteredRows: [], // Cached filtered & sorted rows
};

// DOM Elements
const elements = {
  html: document.documentElement,
  navbar: document.getElementById('app-navbar'),
  fileInput: document.getElementById('file-input'),
  sampleBtn: document.getElementById('sample-btn'),
  sampleBtnHero: document.getElementById('sample-btn-hero'),
  uploadBtnText: document.getElementById('upload-btn-text'),
  fileMeta: document.getElementById('file-meta'),
  activeFilename: document.getElementById('active-filename'),
  sheetSelectorWrap: document.getElementById('sheet-selector-wrap'),
  sheetSelect: document.getElementById('sheet-select'),
  rowCountBadge: document.getElementById('row-count-badge'),
  colCountBadge: document.getElementById('col-count-badge'),
  uploadView: document.getElementById('upload-view'),
  dropzone: document.getElementById('dropzone'),
  tableView: document.getElementById('table-view'),
  globalSearchInput: document.getElementById('global-search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  toggleFilterRowBtn: document.getElementById('toggle-filter-row-btn'),
  statusCount: document.getElementById('status-count'),
  resetAllFiltersBtn: document.getElementById('reset-all-filters-btn'),
  filterChipsBar: document.getElementById('filter-chips-bar'),
  chipsContainer: document.getElementById('chips-container'),
  tableHead: document.getElementById('table-head'),
  tableBody: document.getElementById('table-body'),
  noResults: document.getElementById('no-results'),
  emptyClearBtn: document.getElementById('empty-clear-btn'),
  columnsBtn: document.getElementById('columns-btn'),
  columnsBtnText: document.getElementById('columns-btn-text'),
  columnsPanel: document.getElementById('columns-panel'),
  columnsList: document.getElementById('columns-list'),
  columnSearchInput: document.getElementById('column-search-input'),
  showAllColsBtn: document.getElementById('show-all-cols-btn'),
  hideAllColsBtn: document.getElementById('hide-all-cols-btn'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  pageSizeSelect: document.getElementById('page-size-select'),
  firstPageBtn: document.getElementById('first-page-btn'),
  prevPageBtn: document.getElementById('prev-page-btn'),
  nextPageBtn: document.getElementById('next-page-btn'),
  lastPageBtn: document.getElementById('last-page-btn'),
  pageIndicator: document.getElementById('page-indicator'),
  pageRecordsSummary: document.getElementById('page-records-summary'),
  toastContainer: document.getElementById('toast-container'),
};

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
function init() {
  bindEvents();
  initTheme();
}

function bindEvents() {
  // File upload events
  elements.fileInput.addEventListener('change', handleFileInput);
  elements.sampleBtn.addEventListener('click', loadSampleData);
  elements.sampleBtnHero.addEventListener('click', loadSampleData);

  // Drag and drop
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
  });

  elements.dropzone.addEventListener('dragleave', () => {
    elements.dropzone.classList.remove('dragover');
  });

  elements.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // Sheet switcher
  elements.sheetSelect.addEventListener('change', (e) => {
    switchSheet(e.target.value);
  });

  // Global search
  elements.globalSearchInput.addEventListener('input', (e) => {
    state.globalSearch = e.target.value.trim();
    elements.clearSearchBtn.classList.toggle('hidden', !state.globalSearch);
    state.currentPage = 1;
    applyFiltersAndSort();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.globalSearchInput.value = '';
    state.globalSearch = '';
    elements.clearSearchBtn.classList.add('hidden');
    state.currentPage = 1;
    applyFiltersAndSort();
  });

  // Toggle filter row
  elements.toggleFilterRowBtn.addEventListener('click', () => {
    state.isFilterRowVisible = !state.isFilterRowVisible;
    elements.toggleFilterRowBtn.classList.toggle('active', state.isFilterRowVisible);
    const filterRow = document.getElementById('sub-filter-row');
    if (filterRow) {
      filterRow.classList.toggle('hidden', !state.isFilterRowVisible);
    }
  });

  // Reset all filters
  elements.resetAllFiltersBtn.addEventListener('click', resetAllFilters);
  elements.emptyClearBtn.addEventListener('click', resetAllFilters);

  // Column visibility panel toggle
  elements.columnsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = elements.columnsPanel.classList.toggle('hidden');
    if (!isHidden) {
      elements.columnSearchInput.value = '';
      renderColumnsList();
      elements.columnSearchInput.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!elements.columnsPanel.contains(e.target) && !elements.columnsBtn.contains(e.target)) {
      elements.columnsPanel.classList.add('hidden');
    }
  });

  elements.columnSearchInput.addEventListener('input', (e) => {
    renderColumnsList(e.target.value.trim().toLowerCase());
  });

  elements.showAllColsBtn.addEventListener('click', () => {
    state.allHeaders.forEach((_, idx) => state.visibleColumns.add(idx));
    updateColumnsVisibility();
  });

  elements.hideAllColsBtn.addEventListener('click', () => {
    state.visibleColumns.clear();
    // Keep at least column 0 visible
    state.visibleColumns.add(0);
    updateColumnsVisibility();
  });

  // Export CSV
  elements.exportCsvBtn.addEventListener('click', exportVisibleToCsv);

  // Pagination controls
  elements.pageSizeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.pageSize = val === 'all' ? Infinity : parseInt(val, 10);
    state.currentPage = 1;
    renderTableBody();
    updatePaginationUI();
  });

  elements.firstPageBtn.addEventListener('click', () => goToPage(1));
  elements.prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  elements.nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));
  elements.lastPageBtn.addEventListener('click', () => {
    const totalPages = getTotalPages();
    goToPage(totalPages);
  });

  // Theme toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);
}

// ==========================================================================
// Theme Management
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('datasheet_theme') || 'dark';
  setTheme(savedTheme);
}

function toggleTheme() {
  const current = elements.html.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  setTheme(target);
}

function setTheme(theme) {
  elements.html.setAttribute('data-theme', theme);
  localStorage.setItem('datasheet_theme', theme);
  const sunIcon = elements.themeToggleBtn.querySelector('.sun-icon');
  const moonIcon = elements.themeToggleBtn.querySelector('.moon-icon');
  if (theme === 'dark') {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
}

// ==========================================================================
// File Ingestion & Parsing
// ==========================================================================
function handleFileInput(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
  // Reset input so same file can be reloaded if desired
  e.target.value = '';
}

async function handleFile(file) {
  showToast(`Parsing "${file.name}"...`, 'info');
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in this workbook.');
    }

    state.fileName = file.name;
    state.workbook = workbook;
    state.sheetNames = workbook.SheetNames;
    state.currentSheet = workbook.SheetNames[0];

    updateSheetSelector();
    loadSheetData(state.currentSheet);
    showToast(`Loaded "${file.name}" successfully!`, 'success');
  } catch (err) {
    console.error('File parsing error:', err);
    showToast(`Error parsing file: ${err.message || 'Invalid format'}`, 'error');
  }
}

function loadSampleData() {
  state.fileName = 'Sample_Global_Sales_Q3.xlsx';
  state.workbook = null;
  state.sheetNames = [sampleSheetData.sheetName];
  state.currentSheet = sampleSheetData.sheetName;

  updateSheetSelector();
  processRawHeadersAndRows(sampleSheetData.headers, sampleSheetData.rows);
  showToast('Loaded sample dataset!', 'success');
}

function updateSheetSelector() {
  elements.sheetSelect.innerHTML = '';
  if (state.sheetNames.length > 1) {
    elements.sheetSelectorWrap.classList.remove('hidden');
    state.sheetNames.forEach((sheet) => {
      const opt = document.createElement('option');
      opt.value = sheet;
      opt.textContent = sheet;
      opt.selected = sheet === state.currentSheet;
      elements.sheetSelect.appendChild(opt);
    });
  } else {
    elements.sheetSelectorWrap.classList.add('hidden');
  }
}

function switchSheet(sheetName) {
  if (!state.workbook) return;
  state.currentSheet = sheetName;
  loadSheetData(sheetName);
  showToast(`Switched to sheet "${sheetName}"`, 'info');
}

function loadSheetData(sheetName) {
  const worksheet = state.workbook.Sheets[sheetName];
  if (!worksheet) {
    showToast(`Worksheet "${sheetName}" not found`, 'error');
    return;
  }

  // Convert worksheet to 2D array of rows
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false
  });

  if (rawData.length === 0) {
    showToast('The selected sheet is empty', 'error');
    return;
  }

  // Row 0 is header; rows 1..N are data
  const headers = rawData[0];
  const rows = rawData.slice(1);

  processRawHeadersAndRows(headers, rows);
}

function processRawHeadersAndRows(rawHeaders, rawRows) {
  // Sanitize headers
  const sanitizedHeaders = [];
  const headerCount = {};

  rawHeaders.forEach((h, idx) => {
    let name = (h !== undefined && h !== null && String(h).trim() !== '') 
      ? String(h).trim() 
      : `Column ${idx + 1}`;
    
    // De-duplicate column names
    if (headerCount[name]) {
      headerCount[name] += 1;
      name = `${name}_${headerCount[name]}`;
    } else {
      headerCount[name] = 1;
    }
    sanitizedHeaders.push(name);
  });

  state.allHeaders = sanitizedHeaders;

  // Normalize row length to match headers length
  state.rawRows = rawRows.map((row, rowIdx) => {
    const normalized = [];
    for (let c = 0; c < sanitizedHeaders.length; c++) {
      const val = row[c];
      normalized.push(val !== undefined && val !== null ? val : '');
    }
    // Store original index for row identity
    return {
      _originalIndex: rowIdx + 1,
      values: normalized
    };
  });

  // Infer column data types (numeric, date, string)
  state.columnTypes = inferColumnTypes(state.rawRows, sanitizedHeaders.length);

  // Reset controls & states
  state.visibleColumns = new Set(sanitizedHeaders.map((_, idx) => idx));
  state.sortColumn = null;
  state.sortDirection = 'none';
  state.globalSearch = '';
  state.columnFilters = {};
  state.currentPage = 1;

  elements.globalSearchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');

  // Update UI headers & views
  elements.activeFilename.textContent = state.fileName;
  elements.uploadBtnText.textContent = 'Change File';
  elements.rowCountBadge.textContent = `${state.rawRows.length} rows`;
  elements.colCountBadge.textContent = `${state.allHeaders.length} cols`;

  elements.columnsBtn.disabled = false;
  elements.exportCsvBtn.disabled = false;
  elements.fileMeta.classList.remove('hidden');

  elements.uploadView.classList.add('hidden');
  elements.tableView.classList.remove('hidden');

  renderTableHeader();
  renderColumnsList();
  applyFiltersAndSort();
}

function inferColumnTypes(rows, colCount) {
  const types = [];
  for (let c = 0; c < colCount; c++) {
    let nonEmpties = 0;
    let numericCount = 0;
    for (let r = 0; r < Math.min(rows.length, 50); r++) {
      const val = rows[r].values[c];
      if (val !== '' && val !== null && val !== undefined) {
        nonEmpties++;
        const str = String(val).trim().replace(/^[$,€£¥]/, '');
        if (!isNaN(str) && !isNaN(parseFloat(str))) {
          numericCount++;
        }
      }
    }
    types.push(nonEmpties > 0 && numericCount / nonEmpties > 0.8 ? 'numeric' : 'text');
  }
  return types;
}

// ==========================================================================
// Filtering & Sorting Engine
// ==========================================================================
function applyFiltersAndSort() {
  const { rawRows, globalSearch, columnFilters, sortColumn, sortDirection } = state;
  const colFilterEntries = Object.entries(columnFilters).filter(([_, q]) => q && q.trim() !== '');
  const hasGlobalSearch = globalSearch.length > 0;
  const globalLower = globalSearch.toLowerCase();

  // 1. Filtering
  let result = rawRows.filter((row) => {
    // Check Global Search across visible columns
    if (hasGlobalSearch) {
      let matchedGlobal = false;
      for (const colIdx of state.visibleColumns) {
        const cellStr = String(row.values[colIdx]).toLowerCase();
        if (cellStr.includes(globalLower)) {
          matchedGlobal = true;
          break;
        }
      }
      if (!matchedGlobal) return false;
    }

    // Check Column-specific Filters
    for (const [colIndexStr, query] of colFilterEntries) {
      const colIdx = parseInt(colIndexStr, 10);
      const queryLower = query.toLowerCase().trim();
      const cellStr = String(row.values[colIdx]).toLowerCase();
      if (!cellStr.includes(queryLower)) {
        return false;
      }
    }

    return true;
  });

  // 2. Sorting
  if (sortColumn !== null && sortDirection !== 'none') {
    const isAsc = sortDirection === 'asc';
    const isNumericCol = state.columnTypes[sortColumn] === 'numeric';

    result = [...result].sort((a, b) => {
      const valA = a.values[sortColumn];
      const valB = b.values[sortColumn];

      // Handle null/empty sorting: blanks always go to the bottom
      const emptyA = valA === '' || valA === null || valA === undefined;
      const emptyB = valB === '' || valB === null || valB === undefined;
      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;

      if (isNumericCol) {
        const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g, ''));
        const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return isAsc ? numA - numB : numB - numA;
        }
      }

      // Natural string comparison
      const strA = String(valA);
      const strB = String(valB);
      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return isAsc ? cmp : -cmp;
    });
  }

  state.filteredRows = result;

  // Update Active Filters Chips Bar
  updateFilterChips();

  // Update Status count
  const total = rawRows.length;
  const filtered = result.length;
  if (filtered < total) {
    elements.statusCount.textContent = `Showing ${filtered.toLocaleString()} of ${total.toLocaleString()} rows (Filtered)`;
    elements.resetAllFiltersBtn.classList.remove('hidden');
  } else {
    elements.statusCount.textContent = `Showing all ${total.toLocaleString()} rows`;
    elements.resetAllFiltersBtn.classList.toggle('hidden', sortDirection === 'none');
  }

  // Adjust pagination if page out of bounds
  const totalPages = getTotalPages();
  if (state.currentPage > totalPages) {
    state.currentPage = Math.max(1, totalPages);
  }

  // Render Table Body & UI
  renderTableBody();
  updatePaginationUI();
  updateSortHeadersUI();
}

function resetAllFilters() {
  state.globalSearch = '';
  elements.globalSearchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');

  state.columnFilters = {};
  document.querySelectorAll('.col-filter-input').forEach((inp) => {
    inp.value = '';
    inp.classList.remove('has-value');
  });

  state.sortColumn = null;
  state.sortDirection = 'none';
  state.currentPage = 1;

  applyFiltersAndSort();
  showToast('All filters and sorting reset.', 'info');
}

function updateFilterChips() {
  const chips = [];
  if (state.globalSearch) {
    chips.push({
      label: `Search: "${state.globalSearch}"`,
      remove: () => {
        state.globalSearch = '';
        elements.globalSearchInput.value = '';
        elements.clearSearchBtn.classList.add('hidden');
        applyFiltersAndSort();
      }
    });
  }

  Object.entries(state.columnFilters).forEach(([colIdxStr, query]) => {
    if (query && query.trim()) {
      const idx = parseInt(colIdxStr, 10);
      const colName = state.allHeaders[idx] || `Col ${idx + 1}`;
      chips.push({
        label: `${colName}: "${query}"`,
        remove: () => {
          delete state.columnFilters[idx];
          const inp = document.getElementById(`col-filter-inp-${idx}`);
          if (inp) {
            inp.value = '';
            inp.classList.remove('has-value');
          }
          applyFiltersAndSort();
        }
      });
    }
  });

  if (state.sortColumn !== null && state.sortDirection !== 'none') {
    const colName = state.allHeaders[state.sortColumn] || `Col ${state.sortColumn + 1}`;
    const arrow = state.sortDirection === 'asc' ? '↑' : '↓';
    chips.push({
      label: `Sorted: ${colName} (${arrow})`,
      remove: () => {
        state.sortColumn = null;
        state.sortDirection = 'none';
        applyFiltersAndSort();
      }
    });
  }

  elements.chipsContainer.innerHTML = '';
  if (chips.length > 0) {
    elements.filterChipsBar.classList.remove('hidden');
    chips.forEach((c) => {
      const chipEl = document.createElement('div');
      chipEl.className = 'filter-chip';
      chipEl.innerHTML = `<span>${escapeHtml(c.label)}</span><button class="chip-remove" title="Remove filter">×</button>`;
      chipEl.querySelector('.chip-remove').addEventListener('click', c.remove);
      elements.chipsContainer.appendChild(chipEl);
    });
  } else {
    elements.filterChipsBar.classList.add('hidden');
  }
}

// ==========================================================================
// Table Rendering (Header, Filter Row, Body)
// ==========================================================================
function renderTableHeader() {
  elements.tableHead.innerHTML = '';

  // 1. Column Titles Row
  const trTitle = document.createElement('tr');
  trTitle.className = 'th-row';

  // Fixed Index Column (#)
  const thIndex = document.createElement('th');
  thIndex.className = 'th-cell';
  thIndex.textContent = '#';
  trTitle.appendChild(thIndex);

  // Each header column
  state.allHeaders.forEach((headerName, idx) => {
    if (!state.visibleColumns.has(idx)) return;

    const th = document.createElement('th');
    th.className = 'th-cell th-sortable';
    th.id = `th-col-${idx}`;
    th.title = `Click to sort by "${headerName}"`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'th-content';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'th-title';
    titleSpan.textContent = headerName;

    const sortIcon = document.createElement('span');
    sortIcon.className = 'sort-icon';
    sortIcon.id = `sort-icon-${idx}`;
    sortIcon.innerHTML = getSortIconSvg('none');

    contentDiv.appendChild(titleSpan);
    contentDiv.appendChild(sortIcon);
    th.appendChild(contentDiv);

    th.addEventListener('click', () => handleHeaderSortClick(idx));
    trTitle.appendChild(th);
  });

  elements.tableHead.appendChild(trTitle);

  // 2. Column Filters Row
  const trFilter = document.createElement('tr');
  trFilter.className = 'filter-row';
  trFilter.id = 'sub-filter-row';
  if (!state.isFilterRowVisible) {
    trFilter.classList.add('hidden');
  }

  // Filter cell for index
  const tdIndexFilter = document.createElement('th');
  tdIndexFilter.className = 'filter-cell';
  tdIndexFilter.innerHTML = '<span style="font-size: 0.7rem; color: var(--text-muted);">Filter</span>';
  trFilter.appendChild(tdIndexFilter);

  state.allHeaders.forEach((headerName, idx) => {
    if (!state.visibleColumns.has(idx)) return;

    const td = document.createElement('th');
    td.className = 'filter-cell';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'col-filter-input';
    input.id = `col-filter-inp-${idx}`;
    input.placeholder = `Filter ${headerName}...`;
    input.value = state.columnFilters[idx] || '';
    if (input.value) input.classList.add('has-value');

    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val.trim()) {
        state.columnFilters[idx] = val;
        input.classList.add('has-value');
      } else {
        delete state.columnFilters[idx];
        input.classList.remove('has-value');
      }
      state.currentPage = 1;
      applyFiltersAndSort();
    });

    td.appendChild(input);
    trFilter.appendChild(td);
  });

  elements.tableHead.appendChild(trFilter);
}

function handleHeaderSortClick(colIdx) {
  if (state.sortColumn === colIdx) {
    if (state.sortDirection === 'asc') {
      state.sortDirection = 'desc';
    } else if (state.sortDirection === 'desc') {
      state.sortDirection = 'none';
      state.sortColumn = null;
    } else {
      state.sortDirection = 'asc';
    }
  } else {
    state.sortColumn = colIdx;
    state.sortDirection = 'asc';
  }

  state.currentPage = 1;
  applyFiltersAndSort();
}

function updateSortHeadersUI() {
  state.allHeaders.forEach((_, idx) => {
    const th = document.getElementById(`th-col-${idx}`);
    const icon = document.getElementById(`sort-icon-${idx}`);
    if (!th || !icon) return;

    if (state.sortColumn === idx && state.sortDirection !== 'none') {
      th.classList.add('sorted');
      icon.innerHTML = getSortIconSvg(state.sortDirection);
    } else {
      th.classList.remove('sorted');
      icon.innerHTML = getSortIconSvg('none');
    }
  });
}

function getSortIconSvg(direction) {
  if (direction === 'asc') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
  }
  if (direction === 'desc') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  }
  // Neutral / inactive sort
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.35;"><polyline points="7 15 12 20 17 15"></polyline><polyline points="7 9 12 4 17 9"></polyline></svg>`;
}

function renderTableBody() {
  elements.tableBody.innerHTML = '';
  const rows = state.filteredRows;

  if (rows.length === 0) {
    elements.noResults.classList.remove('hidden');
    return;
  }
  elements.noResults.classList.add('hidden');

  // Compute pagination range
  const pageSize = state.pageSize;
  let startIdx = 0;
  let endIdx = rows.length;

  if (pageSize !== Infinity) {
    startIdx = (state.currentPage - 1) * pageSize;
    endIdx = Math.min(startIdx + pageSize, rows.length);
  }

  const pageRows = rows.slice(startIdx, endIdx);
  const fragment = document.createDocumentFragment();

  pageRows.forEach((rowRecord) => {
    const tr = document.createElement('tr');
    tr.className = 'tb-row';

    // Index Column Cell
    const tdIndex = document.createElement('td');
    tdIndex.className = 'td-cell';
    tdIndex.textContent = rowRecord._originalIndex;
    tr.appendChild(tdIndex);

    // Visible Data Cells
    state.allHeaders.forEach((_, colIdx) => {
      if (!state.visibleColumns.has(colIdx)) return;

      const td = document.createElement('td');
      td.className = 'td-cell';
      const cellVal = rowRecord.values[colIdx];
      const colType = state.columnTypes[colIdx];

      formatCellContent(td, cellVal, colType);

      // Click to copy value
      td.addEventListener('dblclick', () => {
        copyCell(cellVal);
      });

      tr.appendChild(td);
    });

    fragment.appendChild(tr);
  });

  elements.tableBody.appendChild(fragment);
}

function formatCellContent(td, val, colType) {
  if (val === '' || val === null || val === undefined) {
    td.className += ' td-empty';
    td.textContent = '—';
    return;
  }

  const str = String(val);

  // Status detection (e.g. Delivered, Processing, Cancelled, Shipped, Active, Yes, No)
  const lower = str.toLowerCase().trim();
  if (['delivered', 'completed', 'active', 'success', 'paid', 'yes', 'true'].includes(lower)) {
    td.innerHTML = `<span class="status-pill status-success">${escapeHtml(str)}</span>`;
    return;
  }
  if (['processing', 'pending', 'in progress', 'warning'].includes(lower)) {
    td.innerHTML = `<span class="status-pill status-warning">${escapeHtml(str)}</span>`;
    return;
  }
  if (['cancelled', 'failed', 'inactive', 'rejected', 'error', 'no', 'false'].includes(lower)) {
    td.innerHTML = `<span class="status-pill status-danger">${escapeHtml(str)}</span>`;
    return;
  }
  if (['shipped', 'open', 'info'].includes(lower)) {
    td.innerHTML = `<span class="status-pill status-info">${escapeHtml(str)}</span>`;
    return;
  }

  // URL detection
  if (/^https?:\/\//i.test(str)) {
    td.innerHTML = `<a href="${escapeHtml(str)}" target="_blank" rel="noopener noreferrer" class="td-link">${escapeHtml(str)}</a>`;
    return;
  }

  // Number formatting
  if (colType === 'numeric' || (!isNaN(str) && !isNaN(parseFloat(str)) && !str.includes('-') && str.length < 15)) {
    td.className += ' td-number';
    td.textContent = str;
    td.title = str;
    return;
  }

  // Default string
  td.textContent = str;
  td.title = str;
}

function copyCell(text) {
  if (text === '' || text === null || text === undefined) return;
  navigator.clipboard.writeText(String(text)).then(() => {
    showToast(`Copied "${String(text).substring(0, 30)}" to clipboard!`, 'info');
  }).catch(() => {});
}

// ==========================================================================
// Column Visibility Management
// ==========================================================================
function renderColumnsList(filterQuery = '') {
  elements.columnsList.innerHTML = '';

  state.allHeaders.forEach((headerName, idx) => {
    if (filterQuery && !headerName.toLowerCase().includes(filterQuery)) {
      return;
    }

    const label = document.createElement('label');
    label.className = 'col-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.visibleColumns.has(idx);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.visibleColumns.add(idx);
      } else {
        if (state.visibleColumns.size <= 1) {
          checkbox.checked = true;
          showToast('At least one column must remain visible.', 'error');
          return;
        }
        state.visibleColumns.delete(idx);
      }
      updateColumnsVisibility();
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'col-name';
    nameSpan.textContent = headerName;
    nameSpan.title = headerName;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    elements.columnsList.appendChild(label);
  });
}

function updateColumnsVisibility() {
  // Update Columns button text badge
  elements.columnsBtnText.textContent = `Columns (${state.visibleColumns.size}/${state.allHeaders.length})`;

  // Re-render table header and body with the new visible columns
  renderTableHeader();
  renderColumnsList(elements.columnSearchInput.value.trim().toLowerCase());
  applyFiltersAndSort();
}

// ==========================================================================
// Pagination Controls & Calculation
// ==========================================================================
function getTotalPages() {
  if (state.pageSize === Infinity) return 1;
  const count = state.filteredRows.length;
  return Math.max(1, Math.ceil(count / state.pageSize));
}

function goToPage(page) {
  const totalPages = getTotalPages();
  if (page < 1 || page > totalPages) return;
  state.currentPage = page;
  renderTableBody();
  updatePaginationUI();
}

function updatePaginationUI() {
  const totalRows = state.filteredRows.length;
  const totalPages = getTotalPages();
  const page = state.currentPage;

  // Buttons disabled states
  elements.firstPageBtn.disabled = page <= 1;
  elements.prevPageBtn.disabled = page <= 1;
  elements.nextPageBtn.disabled = page >= totalPages;
  elements.lastPageBtn.disabled = page >= totalPages;

  elements.pageIndicator.textContent = `Page ${page} of ${totalPages}`;

  if (totalRows === 0) {
    elements.pageRecordsSummary.textContent = 'Showing 0 records';
    return;
  }

  if (state.pageSize === Infinity) {
    elements.pageRecordsSummary.textContent = `Showing all ${totalRows.toLocaleString()} rows`;
  } else {
    const start = (page - 1) * state.pageSize + 1;
    const end = Math.min(page * state.pageSize, totalRows);
    elements.pageRecordsSummary.textContent = `Showing ${start}–${end} of ${totalRows.toLocaleString()} rows`;
  }
}

// ==========================================================================
// Export visible data to CSV
// ==========================================================================
function exportVisibleToCsv() {
  const visibleColIndices = Array.from(state.visibleColumns).sort((a, b) => a - b);
  if (visibleColIndices.length === 0 || state.filteredRows.length === 0) {
    showToast('No data available to export.', 'error');
    return;
  }

  // Export headers
  const csvHeaders = visibleColIndices.map((idx) => state.allHeaders[idx]);

  // Export rows
  const csvRows = state.filteredRows.map((row) => {
    return visibleColIndices.map((idx) => row.values[idx]);
  });

  const sheetData = [csvHeaders, ...csvRows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  // Download blob
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const baseName = (state.fileName || 'export').replace(/\.[^/.]+$/, '');
  a.download = `${baseName}_filtered.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Exported ${state.filteredRows.length} rows to CSV!`, 'success');
}

// ==========================================================================
// Toast Notification Utility
// ==========================================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, 3200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application
init();
