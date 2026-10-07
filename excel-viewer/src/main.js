import { sampleSheetData } from './sample-data.js';

// Application State (Lightweight, Main Thread)
const state = {
  fileName: '',
  sheetNames: [],
  currentSheet: '',
  allHeaders: [],
  totalRows: 0,
  filteredCount: 0,
  columnTypes: [],
  visibleColumns: new Set(),
  sortColumn: null,
  sortDirection: 'none',
  globalSearch: '',
  columnFilters: {}, // Inline substring query filters
  columnValueFilters: {}, // Excel-style unique values checklists: colIdx -> Array of allowed strings
  columnWidths: {}, // colIdx -> custom pixel width
  isFilterRowVisible: true,
  pageSize: 25,
  currentPage: 1,
};

// Virtual Scrolling Engine (Supports Millions of Rows with Minimal DOM Elements)
const ROW_HEIGHT = 35;
const BUFFER_ROWS = 15;
const CACHE_WINDOW_SIZE = 600; // Sliding cache block on main thread (~150KB memory)
const MAX_BROWSER_SCROLL_HEIGHT = 15000000; // 15 million px ceiling, safe across all browser engines

const virtualState = {
  cacheOffset: 0,
  cacheRows: [],
  isFetchingWindow: false,
  lastRequestedOffset: -1,
  pendingOffset: -1,
  viewportStartIndex: 0,
  viewportEndIndex: 0,
  renderedStartIndex: -1,
  renderedEndIndex: -1,
  renderedTotalRows: -1,
};

// DOM Recycling Pool (Reuses fixed ~45 <tr> elements, zero allocations during scroll)
const domPool = {
  topSpacerTr: null,
  topSpacerTd: null,
  bottomSpacerTr: null,
  bottomSpacerTd: null,
  rowTrs: [],
  isInitialized: false,
};

// Excel-style Popover runtime state (Supports 10,000+ unique values with virtual checklist)
const CHECKLIST_ITEM_HEIGHT = 28;
const cachedUniqueValues = new Map(); // colIdx -> Array of { value, count }
let activePopoverColIdx = null;
let popoverSelectedSet = new Set();
let popoverCurrentUniqueList = [];
let popoverFilteredList = [];
let popoverIsTruncated = false;

// Spawn Web Worker
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

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
  tableScrollContainer: document.getElementById('table-scroll-container'),
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
  pageButtons: document.getElementById('page-buttons'),
  infiniteBadge: document.getElementById('infinite-badge'),
  firstPageBtn: document.getElementById('first-page-btn'),
  prevPageBtn: document.getElementById('prev-page-btn'),
  nextPageBtn: document.getElementById('next-page-btn'),
  lastPageBtn: document.getElementById('last-page-btn'),
  pageIndicator: document.getElementById('page-indicator'),
  pageRecordsSummary: document.getElementById('page-records-summary'),
  toastContainer: document.getElementById('toast-container'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingTitle: document.getElementById('loading-title'),
  loadingStatus: document.getElementById('loading-status'),
  // Excel Popover Elements
  excelFilterPopover: document.getElementById('excel-filter-popover'),
  popoverColTitle: document.getElementById('popover-col-title'),
  popoverCloseBtn: document.getElementById('popover-close-btn'),
  popoverSortAscBtn: document.getElementById('popover-sort-asc-btn'),
  popoverSortDescBtn: document.getElementById('popover-sort-desc-btn'),
  popoverClearColFilterBtn: document.getElementById('popover-clear-col-filter-btn'),
  popoverSearchInput: document.getElementById('popover-search-input'),
  popoverSelectAllChk: document.getElementById('popover-select-all-chk'),
  popoverSelectAllBtn: document.getElementById('popover-select-all-btn'),
  popoverClearAllBtn: document.getElementById('popover-clear-all-btn'),
  popoverValuesList: document.getElementById('popover-values-list'),
  popoverTruncateBanner: document.getElementById('popover-truncate-banner'),
  popoverCancelBtn: document.getElementById('popover-cancel-btn'),
  popoverApplyBtn: document.getElementById('popover-apply-btn'),
  popoverNumSection: document.getElementById('popover-num-section'),
  popoverNumOpSelect: document.getElementById('popover-num-op-select'),
  popoverNumVal1: document.getElementById('popover-num-val1'),
  popoverNumBetweenRow: document.getElementById('popover-num-between-row'),
  popoverNumVal2: document.getElementById('popover-num-val2'),
  popoverNumApplyBtn: document.getElementById('popover-num-apply-btn'),
  popoverNumClearBtn: document.getElementById('popover-num-clear-btn'),
  // Popover Hide Column Button
  popoverHideColBtn: document.getElementById('popover-hide-col-btn'),
  // Column Header Context Menu
  colContextMenu: document.getElementById('col-context-menu'),
  ctxHideColBtn: document.getElementById('ctx-hide-col-btn'),
  ctxHideColText: document.getElementById('ctx-hide-col-text'),
  ctxHideOthersBtn: document.getElementById('ctx-hide-others-btn'),
  ctxUnhideAllBtn: document.getElementById('ctx-unhide-all-btn'),
  ctxSortAscBtn: document.getElementById('ctx-sort-asc-btn'),
  ctxSortDescBtn: document.getElementById('ctx-sort-desc-btn'),
  ctxFilterColBtn: document.getElementById('ctx-filter-col-btn'),
};

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

// ==========================================================================
// Initialization & Worker Listeners
// ==========================================================================
function init() {
  bindEvents();
  initTheme();
  setupWorkerListeners();
}

function setupWorkerListeners() {
  worker.onmessage = (e) => {
    const { type, message, ...data } = e.data;

    switch (type) {
      case 'STATUS':
        updateLoadingStatus(message);
        break;

      case 'PARSE_SUCCESS':
        handleParseSuccess(data);
        break;

      case 'SHEET_SWITCHED':
        handleSheetSwitched(data);
        break;

      case 'QUERY_RESULT':
        handleQueryResult(data);
        break;

      case 'WINDOW_RESULT':
        handleWindowResult(data);
        break;

      case 'UNIQUE_VALUES_RESULT':
        handleUniqueValuesResult(data);
        break;

      case 'EXPORT_CSV_RESULT':
        handleExportCsvResult(data);
        break;

      case 'ERROR':
        hideLoading();
        showToast(message || 'An error occurred', 'error');
        break;

      default:
        console.warn('Unhandled worker response:', type);
    }
  };

  worker.onerror = (err) => {
    console.error('Worker thread error:', err);
    hideLoading();
    showToast('Spreadsheet processor encountered an issue. The file may exceed memory limits.', 'error');
  };
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

  // Virtual scroll listener using requestAnimationFrame for 60fps rendering
  let rafScrollId = null;
  elements.tableScrollContainer.addEventListener('scroll', () => {
    if (state.pageSize !== Infinity) return;
    if (rafScrollId) cancelAnimationFrame(rafScrollId);
    rafScrollId = requestAnimationFrame(() => {
      renderVirtualWindow();
    });
  }, { passive: true });

  // Delegated double-click cell copy on tableBody (zero per-cell listener overhead)
  elements.tableBody.addEventListener('dblclick', (e) => {
    const td = e.target.closest('.td-cell');
    if (td && !td.classList.contains('td-empty') && !td.classList.contains('td-row-index')) {
      const rawVal = td.getAttribute('data-raw') || td.textContent;
      copyCell(rawVal);
    }
  });

  // Sheet switcher
  elements.sheetSelect.addEventListener('change', (e) => {
    const sheetName = e.target.value;
    showLoading('Switching Sheet', `Loading "${sheetName}"...`);
    closeExcelFilterPopover();
    cachedUniqueValues.clear();
    state.columnValueFilters = {};
    worker.postMessage({ type: 'SWITCH_SHEET', payload: { sheetName } });
  });

  // Global search with debounce
  let searchTimer;
  elements.globalSearchInput.addEventListener('input', (e) => {
    state.globalSearch = e.target.value.trim();
    elements.clearSearchBtn.classList.toggle('hidden', !state.globalSearch);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.currentPage = 1;
      queryWorker();
    }, 120);
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.globalSearchInput.value = '';
    state.globalSearch = '';
    elements.clearSearchBtn.classList.add('hidden');
    state.currentPage = 1;
    queryWorker();
  });

  // Toggle inline filter row
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

  // Column visibility panel
  elements.columnsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeExcelFilterPopover();
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
    if (!elements.excelFilterPopover.contains(e.target) && !e.target.closest('.th-filter-btn')) {
      closeExcelFilterPopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeExcelFilterPopover();
      elements.columnsPanel.classList.add('hidden');
    }
  });

  elements.columnSearchInput.addEventListener('input', (e) => {
    renderColumnsList(e.target.value.trim().toLowerCase());
  });

  elements.showAllColsBtn.addEventListener('click', () => {
    unhideAllColumns();
  });

  elements.hideAllColsBtn.addEventListener('click', () => {
    state.visibleColumns.clear();
    state.visibleColumns.add(0);
    updateColumnsVisibility();
    showToast(`Showing only column "${state.allHeaders[0] || 'Column 1'}".`, 'info', {
      text: 'Undo',
      onClick: () => unhideAllColumns()
    });
  });

  // Export CSV (Strictly exports unhidden visible columns only)
  elements.exportCsvBtn.addEventListener('click', () => {
    const visibleCols = Array.from(state.visibleColumns).sort((a, b) => a - b);
    showLoading('Exporting CSV', `Formatting ${visibleCols.length} visible column${visibleCols.length > 1 ? 's' : ''}...`);
    worker.postMessage({
      type: 'EXPORT_CSV',
      payload: {
        visibleCols,
        baseFileName: (state.fileName || 'export').replace(/\.[^/.]+$/, '')
      }
    });
  });

  // Pagination / Page Size controls
  elements.pageSizeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.pageSize = val === 'all' ? Infinity : parseInt(val, 10);
    state.currentPage = 1;
    domPool.isInitialized = false;
    virtualState.renderedStartIndex = -1;
    virtualState.renderedEndIndex = -1;
    virtualState.renderedTotalRows = -1;
    elements.tableScrollContainer.scrollTop = 0;
    queryWorker(1);
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

  // Excel Popover Events
  bindPopoverEvents();
}

function bindPopoverEvents() {
  elements.popoverCloseBtn.addEventListener('click', closeExcelFilterPopover);
  elements.popoverCancelBtn.addEventListener('click', closeExcelFilterPopover);

  // Virtual scroll inside unique values checklist
  elements.popoverValuesList.addEventListener('scroll', () => {
    renderPopoverChecklistVirtual();
  }, { passive: true });

  // Search inside unique values checklist
  elements.popoverSearchInput.addEventListener('input', (e) => {
    filterAndRenderPopoverList(e.target.value);
  });

  // Select all checkbox
  elements.popoverSelectAllChk.addEventListener('change', (e) => {
    const checked = e.target.checked;
    popoverFilteredList.forEach((item) => {
      if (checked) {
        popoverSelectedSet.add(item.value);
      } else {
        popoverSelectedSet.delete(item.value);
      }
    });
    renderPopoverChecklistVirtual();
  });

  // Quick All / None buttons
  elements.popoverSelectAllBtn.addEventListener('click', () => {
    popoverFilteredList.forEach((item) => popoverSelectedSet.add(item.value));
    renderPopoverChecklistVirtual();
  });

  elements.popoverClearAllBtn.addEventListener('click', () => {
    popoverFilteredList.forEach((item) => popoverSelectedSet.delete(item.value));
    renderPopoverChecklistVirtual();
  });

  // Popover Sort buttons
  elements.popoverSortAscBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    state.sortColumn = activePopoverColIdx;
    state.sortDirection = 'asc';
    closeExcelFilterPopover();
    queryWorker(1);
  });

  elements.popoverSortDescBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    state.sortColumn = activePopoverColIdx;
    state.sortDirection = 'desc';
    closeExcelFilterPopover();
    queryWorker(1);
  });

  // Clear this column's value filter
  elements.popoverClearColFilterBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    delete state.columnValueFilters[activePopoverColIdx];
    closeExcelFilterPopover();
    renderTableHeader();
    queryWorker(1);
  });

  // Apply button
  elements.popoverApplyBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;

    if (popoverSelectedSet.size >= popoverCurrentUniqueList.length) {
      delete state.columnValueFilters[activePopoverColIdx];
    } else {
      state.columnValueFilters[activePopoverColIdx] = Array.from(popoverSelectedSet);
    }

    closeExcelFilterPopover();
    renderTableHeader();
    queryWorker(1);
  });

  // Number Filter in Popover
  elements.popoverNumOpSelect.addEventListener('change', (e) => {
    const isBetween = e.target.value === 'between';
    elements.popoverNumBetweenRow.classList.toggle('hidden', !isBetween);
  });

  elements.popoverNumApplyBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    const op = elements.popoverNumOpSelect.value;
    const v1 = elements.popoverNumVal1.value.trim();
    const v2 = elements.popoverNumVal2.value.trim();

    if (!v1 && op !== 'between') return;

    let query = '';
    if (op === 'between') {
      if (!v1 || !v2) return;
      query = `>= ${v1} and <= ${v2}`;
    } else {
      query = `${op} ${v1}`;
    }

    state.columnFilters[activePopoverColIdx] = query;
    const inp = document.getElementById(`col-filter-inp-${activePopoverColIdx}`);
    if (inp) {
      inp.value = query;
      inp.classList.add('has-value');
    }

    closeExcelFilterPopover();
    renderTableHeader();
    queryWorker(1);
  });

  elements.popoverNumClearBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    delete state.columnFilters[activePopoverColIdx];
    const inp = document.getElementById(`col-filter-inp-${activePopoverColIdx}`);
    if (inp) {
      inp.value = '';
      inp.classList.remove('has-value');
    }
    closeExcelFilterPopover();
    renderTableHeader();
    queryWorker(1);
  });

  const onNumInputKeydown = (e) => {
    if (e.key === 'Enter') {
      elements.popoverNumApplyBtn.click();
    }
  };
  elements.popoverNumVal1.addEventListener('keydown', onNumInputKeydown);
  elements.popoverNumVal2.addEventListener('keydown', onNumInputKeydown);

  // Popover Hide Column Action
  elements.popoverHideColBtn.addEventListener('click', () => {
    if (activePopoverColIdx === null) return;
    const colToHide = activePopoverColIdx;
    closeExcelFilterPopover();
    hideColumn(colToHide);
  });

  // Column Header Context Menu Actions
  elements.ctxHideColBtn.addEventListener('click', () => {
    if (activeCtxColIdx !== null) {
      const idx = activeCtxColIdx;
      closeColContextMenu();
      hideColumn(idx);
    }
  });

  elements.ctxHideOthersBtn.addEventListener('click', () => {
    if (activeCtxColIdx !== null) {
      const idx = activeCtxColIdx;
      closeColContextMenu();
      hideOtherColumns(idx);
    }
  });

  elements.ctxUnhideAllBtn.addEventListener('click', () => {
    closeColContextMenu();
    unhideAllColumns();
  });

  elements.ctxSortAscBtn.addEventListener('click', () => {
    if (activeCtxColIdx !== null) {
      const idx = activeCtxColIdx;
      closeColContextMenu();
      state.sortColumn = idx;
      state.sortDirection = 'asc';
      updateSortHeadersUI();
      queryWorker(1);
    }
  });

  elements.ctxSortDescBtn.addEventListener('click', () => {
    if (activeCtxColIdx !== null) {
      const idx = activeCtxColIdx;
      closeColContextMenu();
      state.sortColumn = idx;
      state.sortDirection = 'desc';
      updateSortHeadersUI();
      queryWorker(1);
    }
  });

  elements.ctxFilterColBtn.addEventListener('click', () => {
    if (activeCtxColIdx !== null) {
      const idx = activeCtxColIdx;
      closeColContextMenu();
      const th = document.getElementById(`th-col-${idx}`);
      const btn = th ? th.querySelector('.th-filter-btn') : null;
      if (btn) openExcelFilterPopover(idx, btn);
    }
  });

  // Dismiss context menu on click or escape
  window.addEventListener('click', () => closeColContextMenu());
  window.addEventListener('scroll', () => closeColContextMenu(), true);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeColContextMenu();
      closeExcelFilterPopover();
    }
  });
}

// ==========================================================================
// Virtual Scrolling Engine (DOM Recycling Pool: Supports Millions of Rows)
// ==========================================================================
function getVirtualMetrics() {
  const totalRows = state.filteredCount;
  const headerHeight = elements.tableHead ? (elements.tableHead.offsetHeight || 73) : 73;
  const viewportHeight = elements.tableScrollContainer.clientHeight || 600;
  const availableViewportHeight = Math.max(1, viewportHeight - headerHeight);

  const actualTotalDataHeight = totalRows * ROW_HEIGHT;
  const maxBrowserDataHeight = Math.max(0, MAX_BROWSER_SCROLL_HEIGHT - headerHeight);
  const dataScrollHeight = Math.min(actualTotalDataHeight, maxBrowserDataHeight);

  const scrollTop = elements.tableScrollContainer.scrollTop || 0;

  const maxContainerScroll = Math.max(1, dataScrollHeight - availableViewportHeight);
  const maxVirtualScroll = Math.max(0, actualTotalDataHeight - availableViewportHeight);

  // Proportional scroll ratio mapping 0.0 to 1.0 (reaches very last row accurately)
  const scrollRatio = Math.min(1, Math.max(0, scrollTop / maxContainerScroll));
  const virtualScrollTop = scrollRatio * maxVirtualScroll;

  const visibleCount = Math.ceil(availableViewportHeight / ROW_HEIGHT);
  let startIndex = Math.max(0, Math.floor(virtualScrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  let endIndex = Math.min(totalRows, startIndex + visibleCount + 2 * BUFFER_ROWS);

  if (endIndex >= totalRows) {
    endIndex = totalRows;
    startIndex = Math.max(0, endIndex - (visibleCount + 2 * BUFFER_ROWS));
  }

  const renderedCount = Math.max(0, endIndex - startIndex);
  const heightScale = actualTotalDataHeight > dataScrollHeight ? (actualTotalDataHeight / dataScrollHeight) : 1;
  const topPadding = Math.max(0, Math.floor((startIndex * ROW_HEIGHT) / heightScale));
  const renderedHeight = Math.floor((renderedCount * ROW_HEIGHT) / heightScale);
  const bottomPadding = Math.max(0, dataScrollHeight - topPadding - renderedHeight);

  return {
    totalRows,
    startIndex,
    endIndex,
    renderedCount,
    topPadding,
    bottomPadding,
    heightScale
  };
}

function initVirtualDomPool() {
  elements.tableBody.innerHTML = '';
  domPool.rowTrs = [];

  const colCount = state.visibleColumns.size + 1; // +1 for index (#) column

  // Top Virtual Spacer
  domPool.topSpacerTr = document.createElement('tr');
  domPool.topSpacerTr.className = 'virtual-spacer-tr';
  domPool.topSpacerTd = document.createElement('td');
  domPool.topSpacerTd.colSpan = colCount;
  domPool.topSpacerTd.style.cssText = 'height: 0px; padding: 0; margin: 0; border: none; background: transparent; overflow: hidden; box-sizing: border-box;';
  domPool.topSpacerTr.appendChild(domPool.topSpacerTd);
  elements.tableBody.appendChild(domPool.topSpacerTr);

  // Bottom Virtual Spacer
  domPool.bottomSpacerTr = document.createElement('tr');
  domPool.bottomSpacerTr.className = 'virtual-spacer-tr';
  domPool.bottomSpacerTd = document.createElement('td');
  domPool.bottomSpacerTd.colSpan = colCount;
  domPool.bottomSpacerTd.style.cssText = 'height: 0px; padding: 0; margin: 0; border: none; background: transparent; overflow: hidden; box-sizing: border-box;';
  domPool.bottomSpacerTr.appendChild(domPool.bottomSpacerTd);
  elements.tableBody.appendChild(domPool.bottomSpacerTr);

  domPool.isInitialized = true;
}

function renderVirtualWindow(force = false) {
  if (state.pageSize !== Infinity) return;

  const metrics = getVirtualMetrics();
  virtualState.viewportStartIndex = metrics.startIndex;
  virtualState.viewportEndIndex = metrics.endIndex;

  const cacheStart = virtualState.cacheOffset;
  const cacheEnd = cacheStart + virtualState.cacheRows.length;
  const hasFullCache = metrics.startIndex >= cacheStart && metrics.endIndex <= cacheEnd;

  // Background pre-fetch when approaching window boundary
  const edgeThreshold = 100;
  const nearEdge = (metrics.startIndex - cacheStart < edgeThreshold) || (cacheEnd - metrics.endIndex < edgeThreshold);

  if ((!hasFullCache || nearEdge) && metrics.totalRows > 0) {
    const targetOffset = Math.max(0, metrics.startIndex - Math.floor(CACHE_WINDOW_SIZE / 3));

    if (virtualState.isFetchingWindow) {
      virtualState.pendingOffset = targetOffset;
    } else if (targetOffset !== virtualState.lastRequestedOffset) {
      virtualState.isFetchingWindow = true;
      virtualState.lastRequestedOffset = targetOffset;
      worker.postMessage({
        type: 'QUERY_WINDOW',
        payload: { offset: targetOffset, limit: CACHE_WINDOW_SIZE }
      });
    }
  }

  // Avoid unnecessary DOM updates if rendered row window and row count haven't changed
  const rangeChanged = metrics.startIndex !== virtualState.renderedStartIndex ||
                       metrics.endIndex !== virtualState.renderedEndIndex ||
                       metrics.totalRows !== virtualState.renderedTotalRows;

  if (rangeChanged || force) {
    virtualState.renderedStartIndex = metrics.startIndex;
    virtualState.renderedEndIndex = metrics.endIndex;
    virtualState.renderedTotalRows = metrics.totalRows;
    renderVirtualDOM(metrics);
  }

  updatePaginationUI();
}

function renderVirtualDOM(metrics) {
  const { startIndex, endIndex, topPadding, bottomPadding, totalRows, renderedCount } = metrics;
  const colCount = state.visibleColumns.size + 1;

  if (totalRows === 0) {
    elements.noResults.classList.remove('hidden');
    if (domPool.isInitialized) {
      domPool.topSpacerTr.style.display = 'none';
      domPool.bottomSpacerTr.style.display = 'none';
      domPool.rowTrs.forEach((tr) => { tr.style.display = 'none'; });
    }
    return;
  }
  elements.noResults.classList.add('hidden');

  if (!domPool.isInitialized) {
    initVirtualDomPool();
  }

  // Update Spacer Rows
  domPool.topSpacerTr.style.display = topPadding > 0 ? '' : 'none';
  domPool.topSpacerTr.style.height = `${topPadding}px`;
  domPool.topSpacerTd.style.height = `${topPadding}px`;
  domPool.topSpacerTd.colSpan = colCount;

  domPool.bottomSpacerTr.style.display = bottomPadding > 0 ? '' : 'none';
  domPool.bottomSpacerTr.style.height = `${bottomPadding}px`;
  domPool.bottomSpacerTd.style.height = `${bottomPadding}px`;
  domPool.bottomSpacerTd.colSpan = colCount;

  const cacheStart = virtualState.cacheOffset;
  const cacheLen = virtualState.cacheRows.length;

  // Recycle / populate DOM rows in pool
  for (let i = 0; i < renderedCount; i++) {
    const rowIdx = startIndex + i;
    const cacheRelIdx = rowIdx - cacheStart;

    let tr = domPool.rowTrs[i];
    if (!tr) {
      tr = document.createElement('tr');
      tr.className = 'tb-row';

      // Fixed row index cell (#)
      const tdIdx = document.createElement('td');
      tdIdx.className = 'td-cell td-row-index';
      tr.appendChild(tdIdx);

      // Value cells
      for (let c = 0; c < state.visibleColumns.size; c++) {
        const td = document.createElement('td');
        td.className = 'td-cell';
        tr.appendChild(td);
      }

      elements.tableBody.insertBefore(tr, domPool.bottomSpacerTr);
      domPool.rowTrs.push(tr);
    }

    tr.style.display = '';
    tr.children[0].textContent = rowIdx + 1;

    // Populated from sliding cache
    if (cacheRelIdx >= 0 && cacheRelIdx < cacheLen) {
      const rowRecord = virtualState.cacheRows[cacheRelIdx];
      tr.classList.remove('tb-skeleton-row');

      let cellDomIdx = 1;
      state.allHeaders.forEach((_, colIdx) => {
        if (!state.visibleColumns.has(colIdx)) return;
        const td = tr.children[cellDomIdx++];
        if (!td) return;

        const cellVal = rowRecord.values[colIdx];
        const colType = state.columnTypes[colIdx];
        updateCellDomContent(td, cellVal, colType);
      });
    } else {
      // Skeleton placeholder while window slice is streaming
      tr.classList.add('tb-skeleton-row');
      for (let c = 1; c <= state.visibleColumns.size; c++) {
        const td = tr.children[c];
        if (td) {
          td.className = 'td-cell td-empty';
          td.textContent = '...';
          td.removeAttribute('data-raw');
          td.removeAttribute('title');
        }
      }
    }
  }

  // Hide excess pooled rows
  for (let i = renderedCount; i < domPool.rowTrs.length; i++) {
    domPool.rowTrs[i].style.display = 'none';
  }
}

function updateCellDomContent(td, val, colType) {
  if (val === '' || val === null || val === undefined) {
    td.className = 'td-cell td-empty';
    td.textContent = '—';
    td.removeAttribute('data-raw');
    td.removeAttribute('title');
    return;
  }

  const str = String(val);
  td.setAttribute('data-raw', str);

  // Status badges
  const lower = str.toLowerCase().trim();
  if (['delivered', 'completed', 'active', 'success', 'paid', 'yes', 'true'].includes(lower)) {
    td.className = 'td-cell';
    td.innerHTML = `<span class="status-pill status-success">${escapeHtml(str)}</span>`;
    td.title = str;
    return;
  }
  if (['processing', 'pending', 'in progress', 'warning'].includes(lower)) {
    td.className = 'td-cell';
    td.innerHTML = `<span class="status-pill status-warning">${escapeHtml(str)}</span>`;
    td.title = str;
    return;
  }
  if (['cancelled', 'failed', 'inactive', 'rejected', 'error', 'no', 'false'].includes(lower)) {
    td.className = 'td-cell';
    td.innerHTML = `<span class="status-pill status-danger">${escapeHtml(str)}</span>`;
    td.title = str;
    return;
  }
  if (['shipped', 'open', 'info'].includes(lower)) {
    td.className = 'td-cell';
    td.innerHTML = `<span class="status-pill status-info">${escapeHtml(str)}</span>`;
    td.title = str;
    return;
  }

  // URL links
  if (/^https?:\/\//i.test(str)) {
    td.className = 'td-cell';
    td.innerHTML = `<a href="${escapeHtml(str)}" target="_blank" rel="noopener noreferrer" class="td-link">${escapeHtml(str)}</a>`;
    td.title = str;
    return;
  }

  // Numbers
  if (colType === 'numeric' || (!isNaN(str) && !isNaN(parseFloat(str)) && !str.includes('-') && str.length < 15)) {
    td.className = 'td-cell td-number';
    td.textContent = str;
    td.title = str;
    return;
  }

  // Default text
  td.className = 'td-cell';
  td.textContent = str;
  td.title = str;
}

function handleWindowResult(data) {
  virtualState.cacheOffset = data.offset;
  virtualState.cacheRows = data.rows;
  virtualState.isFetchingWindow = false;

  // Process any pending offset from rapid scrolling
  if (virtualState.pendingOffset >= 0 && virtualState.pendingOffset !== virtualState.cacheOffset) {
    const nextOffset = virtualState.pendingOffset;
    virtualState.pendingOffset = -1;
    virtualState.isFetchingWindow = true;
    worker.postMessage({
      type: 'QUERY_WINDOW',
      payload: { offset: nextOffset, limit: CACHE_WINDOW_SIZE }
    });
  }

  if (state.pageSize === Infinity) {
    renderVirtualWindow(true);
  }
}

// ==========================================================================
// Excel Popover Logic (Virtualized Checklist: Only ~15 Items Rendered)
// ==========================================================================
function openExcelFilterPopover(colIdx, triggerBtn) {
  activePopoverColIdx = colIdx;
  elements.columnsPanel.classList.add('hidden');

  const colName = state.allHeaders[colIdx] || `Column ${colIdx + 1}`;
  elements.popoverColTitle.textContent = `Filter: ${colName}`;
  elements.popoverSearchInput.value = '';

  const rect = triggerBtn.getBoundingClientRect();
  let left = rect.left;
  if (left + 300 > window.innerWidth) {
    left = window.innerWidth - 305;
  }
  if (left < 10) left = 10;

  let top = rect.bottom + 6;
  if (top + 460 > window.innerHeight) {
    top = Math.max(10, rect.top - 460);
  }

  elements.excelFilterPopover.style.top = `${top}px`;
  elements.excelFilterPopover.style.left = `${left}px`;
  elements.excelFilterPopover.classList.remove('hidden');

  const hasActiveFilter = Boolean(state.columnValueFilters[colIdx]);
  elements.popoverClearColFilterBtn.style.opacity = hasActiveFilter ? '1' : '0.4';
  elements.popoverClearColFilterBtn.style.pointerEvents = hasActiveFilter ? 'auto' : 'none';

  // Toggle and initialize Number Filter section
  const isNumeric = state.columnTypes[colIdx] === 'numeric';
  if (isNumeric) {
    elements.popoverNumSection.classList.remove('hidden');
    const existingFilter = state.columnFilters[colIdx] || '';
    const conds = parseNumericFilterConditions(existingFilter);
    if (conds && conds.length === 2 && conds[0].op === '>=' && conds[1].op === '<=') {
      elements.popoverNumOpSelect.value = 'between';
      elements.popoverNumBetweenRow.classList.remove('hidden');
      elements.popoverNumVal1.value = conds[0].val;
      elements.popoverNumVal2.value = conds[1].val;
      elements.popoverNumClearBtn.classList.remove('hidden');
    } else if (conds && conds.length === 1) {
      elements.popoverNumOpSelect.value = conds[0].op === '==' ? '=' : conds[0].op;
      elements.popoverNumBetweenRow.classList.add('hidden');
      elements.popoverNumVal1.value = conds[0].val;
      elements.popoverNumVal2.value = '';
      elements.popoverNumClearBtn.classList.remove('hidden');
    } else {
      elements.popoverNumOpSelect.value = '>';
      elements.popoverNumBetweenRow.classList.add('hidden');
      elements.popoverNumVal1.value = '';
      elements.popoverNumVal2.value = '';
      elements.popoverNumClearBtn.classList.toggle('hidden', !existingFilter);
    }
  } else {
    elements.popoverNumSection.classList.add('hidden');
  }

  if (cachedUniqueValues.has(colIdx)) {
    popoverCurrentUniqueList = cachedUniqueValues.get(colIdx);
    initPopoverSelection(colIdx);
    updatePopoverTruncateBanner(popoverIsTruncated);
    filterAndRenderPopoverList();
  } else {
    elements.popoverTruncateBanner.classList.add('hidden');
    elements.popoverValuesList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        <div class="infinite-spinner" style="margin: 0 auto 8px auto;"></div>
        Extracting unique options...
      </div>`;
    worker.postMessage({
      type: 'GET_UNIQUE_VALUES',
      payload: { colIdx }
    });
  }
}

function handleUniqueValuesResult({ colIdx, uniqueValues, isTruncated }) {
  cachedUniqueValues.set(colIdx, uniqueValues);
  popoverIsTruncated = Boolean(isTruncated);

  if (activePopoverColIdx === colIdx) {
    popoverCurrentUniqueList = uniqueValues;
    initPopoverSelection(colIdx);
    updatePopoverTruncateBanner(popoverIsTruncated);
    filterAndRenderPopoverList();
  }
}

function updatePopoverTruncateBanner(isTruncated) {
  if (isTruncated) {
    elements.popoverTruncateBanner.classList.remove('hidden');
  } else {
    elements.popoverTruncateBanner.classList.add('hidden');
  }
}

function initPopoverSelection(colIdx) {
  if (state.columnValueFilters[colIdx]) {
    popoverSelectedSet = new Set(state.columnValueFilters[colIdx]);
  } else {
    popoverSelectedSet = new Set(popoverCurrentUniqueList.map((item) => item.value));
  }
}

function filterAndRenderPopoverList(searchQuery = '') {
  const trimmed = searchQuery.trim();
  const numConditions = parseNumericFilterConditions(trimmed);

  if (numConditions && numConditions.length > 0) {
    popoverFilteredList = popoverCurrentUniqueList.filter((item) => {
      const num = parseNumericValue(item.value);
      if (num === null) return false;
      for (const cond of numConditions) {
        if (!evalNumericCondition(num, cond.op, cond.val)) return false;
      }
      return true;
    });
  } else {
    const searchLower = trimmed.toLowerCase();
    popoverFilteredList = popoverCurrentUniqueList.filter((item) => {
      if (!searchLower) return true;
      const str = item.value === '' ? '(blanks)' : String(item.value).toLowerCase();
      return str.includes(searchLower);
    });
  }

  elements.popoverValuesList.scrollTop = 0;
  renderPopoverChecklistVirtual();
}

function renderPopoverChecklistVirtual() {
  const scrollTop = elements.popoverValuesList.scrollTop || 0;
  const viewportHeight = 200;
  const totalItems = popoverFilteredList.length;

  if (totalItems === 0) {
    elements.popoverValuesList.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
        No matching values
      </div>`;
    elements.popoverSelectAllChk.checked = false;
    elements.popoverSelectAllChk.indeterminate = false;
    return;
  }

  updateSelectAllChkState(popoverFilteredList);

  const startIndex = Math.max(0, Math.floor(scrollTop / CHECKLIST_ITEM_HEIGHT) - 2);
  const visibleCount = Math.ceil(viewportHeight / CHECKLIST_ITEM_HEIGHT) + 4;
  const endIndex = Math.min(totalItems, startIndex + visibleCount);
  const renderedCount = endIndex - startIndex;

  const topPadding = startIndex * CHECKLIST_ITEM_HEIGHT;
  const bottomPadding = Math.max(0, (totalItems - endIndex) * CHECKLIST_ITEM_HEIGHT);

  elements.popoverValuesList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  // Top Spacer
  if (topPadding > 0) {
    const spacerTop = document.createElement('div');
    spacerTop.className = 'popover-spacer';
    spacerTop.style.height = `${topPadding}px`;
    fragment.appendChild(spacerTop);
  }

  // Render ONLY visible ~12 items
  for (let i = 0; i < renderedCount; i++) {
    const item = popoverFilteredList[startIndex + i];
    const label = document.createElement('label');
    label.className = 'popover-check-item';
    label.style.height = `${CHECKLIST_ITEM_HEIGHT}px`;

    const left = document.createElement('div');
    left.className = 'val-item-left';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = popoverSelectedSet.has(item.value);

    chk.addEventListener('change', () => {
      if (chk.checked) {
        popoverSelectedSet.add(item.value);
      } else {
        popoverSelectedSet.delete(item.value);
      }
      updateSelectAllChkState(popoverFilteredList);
    });

    const spanText = document.createElement('span');
    spanText.className = 'val-text' + (item.value === '' ? ' val-blank' : '');
    spanText.textContent = item.value === '' ? '(Blanks)' : item.value;
    spanText.title = item.value === '' ? '(Blanks)' : item.value;

    left.appendChild(chk);
    left.appendChild(spanText);

    const spanCount = document.createElement('span');
    spanCount.className = 'val-count';
    spanCount.textContent = item.count.toLocaleString();

    label.appendChild(left);
    label.appendChild(spanCount);
    fragment.appendChild(label);
  }

  // Bottom Spacer
  if (bottomPadding > 0) {
    const spacerBottom = document.createElement('div');
    spacerBottom.className = 'popover-spacer';
    spacerBottom.style.height = `${bottomPadding}px`;
    fragment.appendChild(spacerBottom);
  }

  elements.popoverValuesList.appendChild(fragment);
}

function updateSelectAllChkState(filteredItems) {
  let allChecked = true;
  let anyChecked = false;

  filteredItems.forEach((item) => {
    const isChecked = popoverSelectedSet.has(item.value);
    if (isChecked) anyChecked = true;
    else allChecked = false;
  });

  elements.popoverSelectAllChk.checked = allChecked;
  elements.popoverSelectAllChk.indeterminate = !allChecked && anyChecked;
}

function closeExcelFilterPopover() {
  activePopoverColIdx = null;
  elements.excelFilterPopover.classList.add('hidden');
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
// Loading Overlay
// ==========================================================================
function showLoading(title, status) {
  elements.loadingTitle.textContent = title;
  elements.loadingStatus.textContent = status;
  elements.loadingOverlay.classList.remove('hidden');
}

function updateLoadingStatus(status) {
  elements.loadingStatus.textContent = status;
}

function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

// ==========================================================================
// File Ingestion via Web Worker
// ==========================================================================
function handleFileInput(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
  e.target.value = '';
}

async function handleFile(file) {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  showLoading('Loading Spreadsheet', `Reading ${file.name} (${sizeMB} MB)...`);
  closeExcelFilterPopover();
  cachedUniqueValues.clear();
  state.columnValueFilters = {};

  try {
    const buffer = await file.arrayBuffer();
    worker.postMessage({
      type: 'PARSE_FILE',
      payload: { buffer, fileName: file.name }
    }, [buffer]);
  } catch (err) {
    console.error('File read error:', err);
    hideLoading();
    showToast(`Error reading file: ${err.message}`, 'error');
  }
}

function loadSampleData() {
  showLoading('Loading Demo Data', 'Preparing sample dataset...');
  closeExcelFilterPopover();
  cachedUniqueValues.clear();
  state.columnValueFilters = {};

  worker.postMessage({
    type: 'LOAD_SAMPLE',
    payload: { sampleSheetData }
  });
}

function handleParseSuccess(data) {
  hideLoading();

  state.fileName = data.fileName;
  state.sheetNames = data.sheetNames;
  state.currentSheet = data.currentSheet;
  state.allHeaders = data.headers;
  state.totalRows = data.totalRows;
  state.filteredCount = data.totalRows;
  state.columnTypes = data.columnTypes;

  state.visibleColumns = new Set(data.headers.map((_, idx) => idx));
  state.sortColumn = null;
  state.sortDirection = 'none';
  state.globalSearch = '';
  state.columnFilters = {};
  state.columnValueFilters = {};
  state.columnWidths = {};
  state.currentPage = 1;

  elements.globalSearchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');

  updateSheetSelector();

  elements.activeFilename.textContent = state.fileName;
  elements.uploadBtnText.textContent = 'Change File';
  elements.rowCountBadge.textContent = `${state.totalRows.toLocaleString()} rows`;
  elements.colCountBadge.textContent = `${state.allHeaders.length} cols`;

  elements.columnsBtn.disabled = false;
  elements.exportCsvBtn.disabled = false;
  elements.fileMeta.classList.remove('hidden');

  elements.uploadView.classList.add('hidden');
  elements.tableView.classList.remove('hidden');

  domPool.isInitialized = false;
  renderTableHeader();
  renderColumnsList();
  updateColumnsVisibilityBadge();
  updateFilterChips();

  handleQueryResult({
    page: 1,
    pageSize: state.pageSize,
    offset: 0,
    totalRows: state.totalRows,
    filteredCount: state.totalRows,
    rows: data.initialPageRows
  });

  showToast(`Loaded "${state.fileName}" (${state.totalRows.toLocaleString()} rows)`, 'success');
}

function handleSheetSwitched(data) {
  hideLoading();

  state.currentSheet = data.currentSheet;
  state.allHeaders = data.headers;
  state.totalRows = data.totalRows;
  state.filteredCount = data.totalRows;
  state.columnTypes = data.columnTypes;

  state.visibleColumns = new Set(data.headers.map((_, idx) => idx));
  state.sortColumn = null;
  state.sortDirection = 'none';
  state.globalSearch = '';
  state.columnFilters = {};
  state.columnValueFilters = {};
  state.columnWidths = {};
  state.currentPage = 1;

  elements.globalSearchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');

  elements.rowCountBadge.textContent = `${state.totalRows.toLocaleString()} rows`;
  elements.colCountBadge.textContent = `${state.allHeaders.length} cols`;

  domPool.isInitialized = false;
  renderTableHeader();
  renderColumnsList();
  updateColumnsVisibilityBadge();
  updateFilterChips();

  handleQueryResult({
    page: 1,
    pageSize: state.pageSize,
    offset: 0,
    totalRows: state.totalRows,
    filteredCount: state.totalRows,
    rows: data.pageRows
  });

  showToast(`Switched to sheet "${state.currentSheet}"`, 'info');
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

// ==========================================================================
// Query & Worker Communication
// ==========================================================================
function queryWorker(pageOverride) {
  if (pageOverride !== undefined) {
    state.currentPage = pageOverride;
  }

  updateFilterChips();
  updateSortHeadersUI();

  if (state.pageSize === Infinity && (!pageOverride || pageOverride === 1)) {
    elements.tableScrollContainer.scrollTop = 0;
  }

  worker.postMessage({
    type: 'QUERY',
    payload: {
      sortCol: state.sortColumn,
      sortDir: state.sortDirection,
      globalSearch: state.globalSearch,
      colFilters: state.columnFilters,
      columnValueFilters: state.columnValueFilters,
      page: state.currentPage,
      pageSize: state.pageSize,
      isAppend: false,
      visibleCols: Array.from(state.visibleColumns)
    }
  });
}

function handleQueryResult(data) {
  state.currentPage = data.page || 1;
  state.filteredCount = data.filteredCount;

  const hasAnyFilter = data.filteredCount < state.totalRows;
  if (hasAnyFilter) {
    elements.statusCount.textContent = `Showing ${data.filteredCount.toLocaleString()} of ${state.totalRows.toLocaleString()} rows (Filtered)`;
    elements.resetAllFiltersBtn.classList.remove('hidden');
  } else {
    elements.statusCount.textContent = `Showing all ${state.totalRows.toLocaleString()} rows`;
    elements.resetAllFiltersBtn.classList.toggle('hidden', state.sortDirection === 'none');
  }

  if (state.pageSize === Infinity) {
    virtualState.cacheOffset = data.offset || 0;
    virtualState.cacheRows = data.rows || [];
    virtualState.isFetchingWindow = false;
    virtualState.lastRequestedOffset = virtualState.cacheOffset;
    virtualState.renderedStartIndex = -1;
    virtualState.renderedEndIndex = -1;
    virtualState.renderedTotalRows = -1;
    renderVirtualWindow(true);
  } else {
    renderTableBody(data.rows);
  }

  updatePaginationUI();
}

function resetAllFilters() {
  state.globalSearch = '';
  elements.globalSearchInput.value = '';
  elements.clearSearchBtn.classList.add('hidden');

  state.columnFilters = {};
  state.columnValueFilters = {};
  closeExcelFilterPopover();

  document.querySelectorAll('.col-filter-input').forEach((inp) => {
    inp.value = '';
    inp.classList.remove('has-value');
  });

  state.sortColumn = null;
  state.sortDirection = 'none';
  state.currentPage = 1;

  renderTableHeader();
  queryWorker(1);
  showToast('All filters and sorting reset.', 'info');
}

function updateFilterChips() {
  const chips = [];

  // Global search chip
  if (state.globalSearch) {
    chips.push({
      label: `Search: "${state.globalSearch}"`,
      remove: () => {
        state.globalSearch = '';
        elements.globalSearchInput.value = '';
        elements.clearSearchBtn.classList.add('hidden');
        queryWorker(1);
      }
    });
  }

  // Inline column filter chips
  Object.entries(state.columnFilters).forEach(([colIdxStr, query]) => {
    if (query && query.trim()) {
      const idx = parseInt(colIdxStr, 10);
      const colName = state.allHeaders[idx] || `Col ${idx + 1}`;
      const isNum = parseNumericFilterConditions(query);
      const label = isNum ? `${colName}: ${query}` : `${colName} contains "${query}"`;
      chips.push({
        label,
        remove: () => {
          delete state.columnFilters[idx];
          const inp = document.getElementById(`col-filter-inp-${idx}`);
          if (inp) {
            inp.value = '';
            inp.classList.remove('has-value');
          }
          queryWorker(1);
        }
      });
    }
  });

  // Excel unique values checklist chips
  Object.entries(state.columnValueFilters).forEach(([colIdxStr, allowedList]) => {
    const idx = parseInt(colIdxStr, 10);
    const colName = state.allHeaders[idx] || `Col ${idx + 1}`;
    const totalDistinct = cachedUniqueValues.get(idx)?.length;
    let label;

    if (allowedList.length === 1) {
      label = `${colName} = "${allowedList[0] === '' ? '(Blanks)' : allowedList[0]}"`;
    } else if (totalDistinct) {
      label = `${colName}: ${allowedList.length} of ${totalDistinct} values`;
    } else {
      label = `${colName}: ${allowedList.length} values`;
    }

    chips.push({
      label,
      remove: () => {
        delete state.columnValueFilters[idx];
        renderTableHeader();
        queryWorker(1);
      }
    });
  });

  // Sort chip
  if (state.sortColumn !== null && state.sortDirection !== 'none') {
    const colName = state.allHeaders[state.sortColumn] || `Col ${state.sortColumn + 1}`;
    const arrow = state.sortDirection === 'asc' ? '↑' : '↓';
    chips.push({
      label: `Sorted: ${colName} (${arrow})`,
      remove: () => {
        state.sortColumn = null;
        state.sortDirection = 'none';
        queryWorker(1);
      }
    });
  }

  elements.chipsContainer.innerHTML = '';
  if (chips.length > 0 || state.visibleColumns.size < state.allHeaders.length) {
    elements.filterChipsBar.classList.remove('hidden');

    // Render active filter chips
    chips.forEach((c) => {
      const chipEl = document.createElement('div');
      chipEl.className = 'filter-chip';
      chipEl.innerHTML = `<span>${escapeHtml(c.label)}</span><button class="chip-remove" title="Remove filter">×</button>`;
      chipEl.querySelector('.chip-remove').addEventListener('click', c.remove);
      elements.chipsContainer.appendChild(chipEl);
    });

    // Render hidden columns indicator chip
    const hiddenCount = state.allHeaders.length - state.visibleColumns.size;
    if (hiddenCount > 0 && state.allHeaders.length > 0) {
      const hiddenCols = state.allHeaders
        .map((name, i) => ({ name, idx: i }))
        .filter(({ idx }) => !state.visibleColumns.has(idx));

      const hiddenChipEl = document.createElement('div');
      hiddenChipEl.className = 'hidden-cols-chip';
      hiddenChipEl.innerHTML = `<span>👁️ ${hiddenCount} Hidden:</span>`;

      hiddenCols.slice(0, 4).forEach((col) => {
        const tag = document.createElement('span');
        tag.className = 'hidden-tag';
        tag.title = `Click to unhide "${col.name}"`;
        tag.innerHTML = `${escapeHtml(col.name)} <strong>+</strong>`;
        tag.addEventListener('click', () => unhideColumn(col.idx));
        hiddenChipEl.appendChild(tag);
      });

      if (hiddenCols.length > 4) {
        const more = document.createElement('span');
        more.style.fontSize = '0.73rem';
        more.textContent = `+${hiddenCols.length - 4} more`;
        hiddenChipEl.appendChild(more);
      }

      const unhideAllBtn = document.createElement('button');
      unhideAllBtn.type = 'button';
      unhideAllBtn.className = 'unhide-all-btn';
      unhideAllBtn.textContent = 'Unhide All';
      unhideAllBtn.title = 'Unhide all columns';
      unhideAllBtn.addEventListener('click', () => unhideAllColumns());
      hiddenChipEl.appendChild(unhideAllBtn);

      elements.chipsContainer.appendChild(hiddenChipEl);
    }
  } else {
    elements.filterChipsBar.classList.add('hidden');
  }
}

// Column Context Menu State & Handlers
let activeCtxColIdx = null;

function openColContextMenu(e, colIdx) {
  activeCtxColIdx = colIdx;
  const colName = state.allHeaders[colIdx] || `Column ${colIdx + 1}`;
  elements.ctxHideColText.textContent = `Hide "${colName}"`;

  const hiddenCount = state.allHeaders.length - state.visibleColumns.size;
  elements.ctxUnhideAllBtn.style.display = hiddenCount > 0 ? 'flex' : 'none';

  const menu = elements.colContextMenu;
  menu.classList.remove('hidden');

  const x = Math.min(e.clientX, window.innerWidth - 215);
  const y = Math.min(e.clientY, window.innerHeight - 230);
  menu.style.left = `${Math.max(10, x)}px`;
  menu.style.top = `${Math.max(10, y)}px`;
}

function closeColContextMenu() {
  elements.colContextMenu.classList.add('hidden');
  activeCtxColIdx = null;
}

function hideColumn(colIdx) {
  if (state.visibleColumns.size <= 1) {
    showToast('At least one column must remain visible.', 'error');
    return;
  }
  const colName = state.allHeaders[colIdx] || `Column ${colIdx + 1}`;
  state.visibleColumns.delete(colIdx);
  updateColumnsVisibility();
  showToast(`Column "${colName}" hidden.`, 'info', {
    text: 'Undo',
    onClick: () => unhideColumn(colIdx)
  });
}

function unhideColumn(colIdx) {
  state.visibleColumns.add(colIdx);
  updateColumnsVisibility();
  const colName = state.allHeaders[colIdx] || `Column ${colIdx + 1}`;
  showToast(`Column "${colName}" unhidden.`, 'success');
}

function unhideAllColumns() {
  state.allHeaders.forEach((_, idx) => state.visibleColumns.add(idx));
  updateColumnsVisibility();
  showToast('All columns are now visible.', 'success');
}

function hideOtherColumns(colIdx) {
  state.visibleColumns.clear();
  state.visibleColumns.add(colIdx);
  updateColumnsVisibility();
  const colName = state.allHeaders[colIdx] || `Column ${colIdx + 1}`;
  showToast(`Showing only column "${colName}".`, 'info', {
    text: 'Undo',
    onClick: () => unhideAllColumns()
  });
}

// ==========================================================================
// Table Header & Rows Rendering
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

  const visibleIndices = Array.from(state.visibleColumns).sort((a, b) => a - b);

  // If first visible column is not 0, there are hidden columns at the very start
  if (visibleIndices.length > 0 && visibleIndices[0] > 0) {
    const unhideStartBtn = document.createElement('button');
    unhideStartBtn.type = 'button';
    unhideStartBtn.className = 'th-unhide-indicator th-unhide-right';
    const hiddenCount = visibleIndices[0];
    unhideStartBtn.title = `Click to unhide ${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''}`;
    unhideStartBtn.textContent = '⇥';
    unhideStartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      for (let i = 0; i < visibleIndices[0]; i++) {
        state.visibleColumns.add(i);
      }
      updateColumnsVisibility();
      showToast(`Unhid ${hiddenCount} column${hiddenCount > 1 ? 's' : ''}.`, 'success');
    });
    thIndex.appendChild(unhideStartBtn);
  }
  trTitle.appendChild(thIndex);

  visibleIndices.forEach((idx, vOrder) => {
    const headerName = state.allHeaders[idx] || `Column ${idx + 1}`;
    const th = document.createElement('th');
    th.className = 'th-cell th-sortable';
    th.id = `th-col-${idx}`;
    th.title = `Click to sort by "${headerName}", right-click for options`;

    const calcWidth = state.columnWidths[idx] || Math.min(360, Math.max(150, headerName.length * 9 + 65));
    th.style.width = `${calcWidth}px`;
    th.style.minWidth = '140px';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'th-content';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'th-title';
    titleSpan.textContent = headerName;

    // Right action icons
    const thActions = document.createElement('div');
    thActions.className = 'th-actions';

    // Quick Hide Column Button
    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'th-hide-btn';
    hideBtn.title = `Hide column "${headerName}"`;
    hideBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideColumn(idx);
    });

    const filterBtn = document.createElement('button');
    filterBtn.type = 'button';
    const hasValueFilter = Boolean(state.columnValueFilters[idx]);
    filterBtn.className = 'th-filter-btn' + (hasValueFilter ? ' has-filter' : '');
    filterBtn.title = `Filter unique values in "${headerName}"`;
    filterBtn.innerHTML = getFilterFunnelSvg(hasValueFilter);

    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openExcelFilterPopover(idx, filterBtn);
    });

    const sortIcon = document.createElement('span');
    sortIcon.className = 'sort-icon';
    sortIcon.id = `sort-icon-${idx}`;
    sortIcon.innerHTML = getSortIconSvg('none');

    thActions.appendChild(hideBtn);
    thActions.appendChild(filterBtn);
    thActions.appendChild(sortIcon);

    contentDiv.appendChild(titleSpan);
    contentDiv.appendChild(thActions);
    th.appendChild(contentDiv);

    // Draggable column resize handle
    const resizer = document.createElement('div');
    resizer.className = 'th-resizer';
    resizer.title = 'Drag to resize column, double-click to auto-fit';
    resizer.addEventListener('click', (e) => e.stopPropagation());
    resizer.addEventListener('mousedown', (e) => initColumnResize(e, idx, th));
    resizer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      autoFitColumnWidth(idx, headerName, th);
    });
    th.appendChild(resizer);

    // Unhide indicator between columns or at the end
    const nextIdx = visibleIndices[vOrder + 1];
    if (nextIdx !== undefined && nextIdx - idx > 1) {
      const gapCount = nextIdx - idx - 1;
      const unhideBetweenBtn = document.createElement('button');
      unhideBetweenBtn.type = 'button';
      unhideBetweenBtn.className = 'th-unhide-indicator th-unhide-right';
      unhideBetweenBtn.title = `Click to unhide ${gapCount} hidden column${gapCount > 1 ? 's' : ''}`;
      unhideBetweenBtn.textContent = '⇥⇤';
      unhideBetweenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        for (let g = idx + 1; g < nextIdx; g++) {
          state.visibleColumns.add(g);
        }
        updateColumnsVisibility();
        showToast(`Unhid ${gapCount} column${gapCount > 1 ? 's' : ''}.`, 'success');
      });
      th.appendChild(unhideBetweenBtn);
    } else if (vOrder === visibleIndices.length - 1 && idx < state.allHeaders.length - 1) {
      const endGapCount = state.allHeaders.length - 1 - idx;
      const unhideEndBtn = document.createElement('button');
      unhideEndBtn.type = 'button';
      unhideEndBtn.className = 'th-unhide-indicator th-unhide-right';
      unhideEndBtn.title = `Click to unhide ${endGapCount} hidden column${endGapCount > 1 ? 's' : ''}`;
      unhideEndBtn.textContent = '⇤';
      unhideEndBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        for (let g = idx + 1; g < state.allHeaders.length; g++) {
          state.visibleColumns.add(g);
        }
        updateColumnsVisibility();
        showToast(`Unhid ${endGapCount} column${endGapCount > 1 ? 's' : ''}.`, 'success');
      });
      th.appendChild(unhideEndBtn);
    }

    th.addEventListener('click', () => handleHeaderSortClick(idx));
    th.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openColContextMenu(e, idx);
    });

    trTitle.appendChild(th);
  });

  elements.tableHead.appendChild(trTitle);

  // 2. Column Inline Filters Row
  const trFilter = document.createElement('tr');
  trFilter.className = 'filter-row';
  trFilter.id = 'sub-filter-row';
  if (!state.isFilterRowVisible) {
    trFilter.classList.add('hidden');
  }

  const tdIndexFilter = document.createElement('th');
  tdIndexFilter.className = 'filter-cell';
  tdIndexFilter.innerHTML = '<span style="font-size: 0.7rem; color: var(--text-muted);">Filter</span>';
  trFilter.appendChild(tdIndexFilter);

  let colFilterTimer;
  state.allHeaders.forEach((headerName, idx) => {
    if (!state.visibleColumns.has(idx)) return;

    const calcWidth = state.columnWidths[idx] || Math.min(360, Math.max(150, headerName.length * 9 + 65));
    const td = document.createElement('th');
    td.className = 'filter-cell';
    td.id = `filter-col-${idx}`;
    td.style.width = `${calcWidth}px`;
    td.style.minWidth = '140px';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'col-filter-input';
    input.id = `col-filter-inp-${idx}`;
    const isNumCol = state.columnTypes[idx] === 'numeric';
    input.placeholder = isNumCol ? `e.g. >50, <=200, !=0` : `Contains...`;
    input.title = isNumCol ? `Filter numbers using >, >=, =, <, <=, != or range (e.g. >10 and <50)` : `Filter text (contains substring)`;
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

      clearTimeout(colFilterTimer);
      colFilterTimer = setTimeout(() => {
        state.currentPage = 1;
        queryWorker(1);
      }, 120);
    });

    td.appendChild(input);
    trFilter.appendChild(td);
  });

  elements.tableHead.appendChild(trFilter);
}

function initColumnResize(e, colIdx, thEl) {
  e.stopPropagation();
  e.preventDefault();

  const startX = e.clientX;
  const startWidth = thEl.offsetWidth;
  const resizer = e.target;
  resizer.classList.add('is-resizing');

  function onMouseMove(moveEvent) {
    const delta = moveEvent.clientX - startX;
    const newWidth = Math.max(100, startWidth + delta);
    thEl.style.width = `${newWidth}px`;
    state.columnWidths[colIdx] = newWidth;

    const filterCell = document.getElementById(`filter-col-${colIdx}`);
    if (filterCell) {
      filterCell.style.width = `${newWidth}px`;
    }
  }

  function onMouseUp() {
    resizer.classList.remove('is-resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function autoFitColumnWidth(colIdx, headerName, thEl) {
  const approxWidth = Math.min(400, Math.max(150, headerName.length * 10 + 75));
  thEl.style.width = `${approxWidth}px`;
  state.columnWidths[colIdx] = approxWidth;

  const filterCell = document.getElementById(`filter-col-${colIdx}`);
  if (filterCell) {
    filterCell.style.width = `${approxWidth}px`;
  }
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

  queryWorker(1);
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
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.35;"><polyline points="7 15 12 20 17 15"></polyline><polyline points="7 9 12 4 17 9"></polyline></svg>`;
}

function getFilterFunnelSvg(isActive) {
  if (isActive) {
    return `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;
  }
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`;
}

function renderTableBody(rows) {
  elements.tableBody.innerHTML = '';
  domPool.isInitialized = false;

  if (!rows || rows.length === 0) {
    elements.noResults.classList.remove('hidden');
    return;
  }
  elements.noResults.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  rows.forEach((rowRecord) => {
    fragment.appendChild(createTableRow(rowRecord));
  });
  elements.tableBody.appendChild(fragment);
}

function createTableRow(rowRecord) {
  const tr = document.createElement('tr');
  tr.className = 'tb-row';

  // Row index cell (#)
  const tdIndex = document.createElement('td');
  tdIndex.className = 'td-cell td-row-index';
  tdIndex.textContent = rowRecord._originalIndex;
  tr.appendChild(tdIndex);

  // Visible cells
  state.allHeaders.forEach((_, colIdx) => {
    if (!state.visibleColumns.has(colIdx)) return;

    const td = document.createElement('td');
    td.className = 'td-cell';
    const cellVal = rowRecord.values[colIdx];
    const colType = state.columnTypes[colIdx];

    updateCellDomContent(td, cellVal, colType);
    tr.appendChild(td);
  });

  return tr;
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
  domPool.isInitialized = false;
  updateColumnsVisibilityBadge();
  updateFilterChips();
  renderTableHeader();
  renderColumnsList(elements.columnSearchInput.value.trim().toLowerCase());
  queryWorker();
}

function updateColumnsVisibilityBadge() {
  const visibleCount = state.visibleColumns.size;
  const totalCount = state.allHeaders.length;
  const hiddenCount = totalCount - visibleCount;

  if (hiddenCount > 0) {
    elements.columnsBtnText.textContent = `Columns (${visibleCount}/${totalCount} • ${hiddenCount} Hidden)`;
    elements.columnsBtn.classList.add('has-hidden-cols');
    elements.exportCsvBtn.title = `Export ${visibleCount} visible columns to CSV (${hiddenCount} hidden columns excluded)`;
  } else {
    elements.columnsBtnText.textContent = `Columns (${totalCount}/${totalCount})`;
    elements.columnsBtn.classList.remove('has-hidden-cols');
    elements.exportCsvBtn.title = 'Export all columns to CSV';
  }
}

// ==========================================================================
// Pagination Controls & Calculation
// ==========================================================================
function getTotalPages() {
  if (state.pageSize === Infinity) return 1;
  const count = state.filteredCount;
  return Math.max(1, Math.ceil(count / state.pageSize));
}

function goToPage(page) {
  const totalPages = getTotalPages();
  if (page < 1 || page > totalPages) return;
  state.currentPage = page;
  queryWorker(page);
}

function updatePaginationUI() {
  const totalRows = state.filteredCount;
  const totalPages = getTotalPages();
  const page = state.currentPage;

  // In virtual scroll mode
  if (state.pageSize === Infinity) {
    elements.pageButtons.classList.add('hidden');
    elements.infiniteBadge.classList.remove('hidden');

    if (totalRows === 0) {
      elements.pageRecordsSummary.textContent = 'Showing 0 records';
    } else {
      const vStart = Math.min(totalRows, virtualState.viewportStartIndex + 1);
      const vEnd = Math.min(totalRows, virtualState.viewportEndIndex);
      elements.pageRecordsSummary.textContent = `Viewing rows ${vStart.toLocaleString()}–${vEnd.toLocaleString()} of ${totalRows.toLocaleString()} (Virtual Scroll)`;
    }
    return;
  }

  // Fixed page size mode
  elements.pageButtons.classList.remove('hidden');
  elements.infiniteBadge.classList.add('hidden');

  elements.firstPageBtn.disabled = page <= 1;
  elements.prevPageBtn.disabled = page <= 1;
  elements.nextPageBtn.disabled = page >= totalPages;
  elements.lastPageBtn.disabled = page >= totalPages;

  elements.pageIndicator.textContent = `Page ${page} of ${totalPages}`;

  if (totalRows === 0) {
    elements.pageRecordsSummary.textContent = 'Showing 0 records';
    return;
  }

  const start = (page - 1) * state.pageSize + 1;
  const end = Math.min(page * state.pageSize, totalRows);
  elements.pageRecordsSummary.textContent = `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${totalRows.toLocaleString()} rows`;
}

// ==========================================================================
// Export CSV Result Handling
// ==========================================================================
function handleExportCsvResult({ blob, fileName, count, colCount }) {
  hideLoading();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const exportedCols = colCount || state.visibleColumns.size;
  const hiddenCount = state.allHeaders.length - exportedCols;
  const hiddenNotice = hiddenCount > 0 ? ` (${hiddenCount} hidden column${hiddenCount > 1 ? 's' : ''} excluded)` : '';
  showToast(`Exported ${count.toLocaleString()} rows and ${exportedCols} visible columns${hiddenNotice} to CSV!`, 'success');
}

// ==========================================================================
// Toast Notification Utility
// ==========================================================================
function showToast(message, type = 'info', action = null) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (action && action.text && action.onClick) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action-btn';
    actionBtn.textContent = action.text;
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
    toast.appendChild(actionBtn);
  }

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
  }, 4000);
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
