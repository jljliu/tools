# Excel & CSV Viewer (Read-Only) Specification

## 1. Overview
A modern, high-performance, 100% client-side spreadsheet viewer web application. Users can upload any `.xlsx`, `.xls`, or `.csv` file and immediately explore, sort, filter, and inspect data in a responsive tabular interface. All processing happens entirely within the user's browser with zero backend dependencies, guaranteeing total data privacy.

## 2. Requirements & Features

### 2.1 File Ingestion
- **File formats supported**: `.xlsx`, `.xls`, `.csv`.
- **Upload methods**:
  - Drag-and-drop zone with visual hover feedback.
  - Native file picker file dialog.
  - "Load Sample Data" one-click demo dataset.
- **Multi-Sheet Handling**: For multi-sheet `.xlsx` files, a sheet switcher dropdown allows toggling between worksheets without re-uploading.
- **Client-Side Parsing**: Powered by SheetJS (`xlsx`) in the browser. No data leaves the device.

### 2.2 Table Rendering & Structure
- **Header detection**: First row is parsed as column headers; subsequent rows are data records.
- **Empty column names**: Automatically labelled as `Column 1`, `Column 2`, etc.
- **Column Width & Horizontal Scrolling (Wide Spreadsheets Support)**:
  - **Guaranteed Minimum Width**: Every data column enforces a minimum width of `140px` (defaulting dynamically between `150px` and `360px` based on header length), ensuring that spreadsheets with 50–100+ columns never collapse into illegible slivers.
  - **Fluid Container Expansion**: The table uses `width: max-content; min-width: 100%`, enabling smooth horizontal scrolling across wide sheets while filling the screen for narrower sheets.
  - **Interactive Column Resizing**: Each column header features a draggable `.th-resizer` handle on its right border. Users can drag to customize any column's width, or double-click the handle to auto-fit.
  - **Frozen Pane Row Numbering**: The `#` index column is pinned sticky on the left (`position: sticky; left: 0; z-index: 15/35`) with elevation shadows, maintaining row referencing while scrolling horizontally.
- **Sticky headers**: Header row remains pinned while scrolling through large datasets.
- **Cell formatting & auto-detection**:
  - Right-aligned monospace presentation for numbers and currencies.
  - Semantic pill tags for common status values (e.g. `Completed`, `Active`, `Pending`, `Cancelled`).
  - Clickable URL links when cell contains valid web addresses.
  - Muted placeholders (`—`) for blank/null values.
  - Double-click to copy cell value with toast notification.

### 2.3 Sorting
- **Header sorting**: Clicking a column header toggles through:
  1. Ascending (`▲`)
  2. Descending (`▼`)
  3. Reset to original order (`↕`)
- **Smart type sorting**:
  - Numeric sorting for numeric strings and numbers.
  - Date sorting for parsed dates.
  - Case-insensitive natural alphabetical sorting for text.
- **Visual feedback**: Active sort column is highlighted with an arrow badge.

### 2.4 Filtering
- **Excel-Style Column Unique Values Filter Popover**:
  - Each column header features a dedicated filter funnel button (`.th-filter-btn`).
  - Clicking opens an Excel-like popover menu listing all distinct options in that column with occurrence counts (e.g. `Delivered (15)`, `Processing (8)`, `(Blanks) (2)`).
  - Users can check and uncheck individual values to precisely include or exclude records.
  - Search input inside the popover enables rapid searching through large lists of unique values.
  - Quick action controls: "(Select All)" checkbox with indeterminate state, "All" and "None" bulk selectors.
  - Built-in shortcuts for "Sort Ascending", "Sort Descending", and "Clear Filter".
  - Active filter visual badge: the funnel button is highlighted in accent color when a column has filtered values.
  - Unique value extraction is executed in the Web Worker (~15ms for 400,000 rows) with client-side caching.
- **Global search**: Instant search input filtering across all visible columns simultaneously.
- **Per-column inline text filters**: Inline filter inputs below each column header for targeted substring matching.
- **Filter chips**: Displays currently active column filters and value checklist filters with individual remove buttons and a "Clear All" action.
- **Real-time count**: Displays filtered count vs total count (e.g. `Showing 42 of 150 rows`).

### 2.5 Column Visibility
- **Column selector panel**: Dropdown / drawer listing all headers with checkboxes.
- **Quick controls**: "Show All" and "Hide All" (preserving at least 1 column).
- **Search columns**: Quick filter for wide spreadsheets with 20+ columns.
- **Persistence during session**: Hidden columns do not render in header or data cells, but maintain their sorting/filter states when unhidden.

### 2.6 Pagination & DOM Virtualization Engine (Scale to Millions of Rows)
- **Page sizes**: 15, 25, 50, 100, 500, or "All (Virtual Scroll)".
- **Pagination mode (15–500)**: First, Prev, Page indicator, Next, Last navigation buttons with instant sub-millisecond page slicing.
- **Virtual Scroll mode ("All")**: 
  - **DOM Recycling Pool (`domPool`)**: Reuses a fixed pool of ~35–50 `<tr>` elements. When scrolling through millions of rows, rows in the viewport are updated in-place (`textContent` and CSS classes). Zero DOM elements are created or destroyed during scroll, eliminating GC churn and frame drops.
  - **Scroll Anchoring Prevention (`overflow-anchor: none`)**: Explicitly disables browser scroll anchoring on `.table-scroll-container`, `.data-table`, `thead`, `tbody`, `.virtual-spacer-tr`, and `.tb-row`. This prevents the browser engine from automatically adjusting `scrollTop` when spacer rows resize, permanently eliminating runaway auto-scrolling loops.
  - **Pixel-Locked Row Dimensions**: Table body rows (`.tb-row`) and cells (`.td-cell`) enforce strict `height: 35px !important; max-height: 35px !important; line-height: 33px !important; box-sizing: border-box !important;`. The total rendered table height remains perfectly invariant without jitter across diverse cell content or badges.
  - **Sticky Header Height Accounting**: Virtual scroll mathematics integrate the sticky table header height (`thead.offsetHeight || 73px`) into container scrollable ranges (`availableViewportHeight = viewportHeight - headerHeight`), ensuring the container scrollbar boundaries and virtual rows align down to the exact pixel.
  - **Render Change Guard**: Skips redundant DOM mutations when the calculated `[startIndex, endIndex]` range and row count are unchanged within the 15-row buffer, ensuring 100% smooth native GPU-accelerated compositor scrolling.
  - **Top & Bottom Virtual Spacer Rows**: Calculates virtual scroll positions with scaled spacer row heights (`virtual-spacer-tr`).
  - **Proportional Scroll Travel Ratio**: Accurately normalizes container scroll distance (`scrollTop / maxContainerScroll`) to virtual dataset travel (`scrollRatio * maxVirtualScroll`), preventing browser max scroll height clipping and ensuring the very last rows (even row 2,000,000) are fully accessible.
  - **Sliding Cache Window**: Main thread retains only a lightweight sliding cache window (~600 rows in memory), streaming window chunks from the Web Worker asynchronously on demand (`QUERY_WINDOW`).
  - **Delegated Event Architecture**: Table-level event delegation handles cell copying (`dblclick`) without attaching per-cell event listeners or closures.

### 2.7 Export & Utilities
- Export visible / filtered table rows to CSV via Web Worker.
- Safe chunked streaming export (5,000-row chunks directly to `Blob`) preventing V8 512MB max string length crashes (`RangeError: Invalid string length`).
- Copy table data to clipboard with feedback toasts.
- Light / Dark theme toggle.

### 2.8 Large File & Performance Architecture (Millions of Rows Support)
- **Dedicated Web Worker (`worker.js`)**: All spreadsheet parsing, CSV streaming, data indexing, sorting, filtering, and CSV export execute in a background Web Worker thread. Main thread UI maintains 60fps responsiveness.
- **Streaming RFC 4180 CSV Parser**: Direct `TextDecoder` and slice-based CSV parser in the worker that bypasses SheetJS memory overhead for `.csv` files. Parses 1,000,000+ rows in ~300ms using less than 100MB of RAM.
- **Dense Mode XLSX Ingestion**: SheetJS parses Excel files with `dense: true`, `cellDates: true`, `raw: true`, releasing parsed cell objects row-by-row during extraction to minimize peak memory consumption.
- **Compact Typed Array Indexing**: Row matching and filtering operate over compact `Int32Array` buffers (only 4MB RAM per 1,000,000 rows).
- **High-Speed Precomputed Key Sorting**: Numeric columns extract values into `Float64Array`, and string columns use standard comparison operators (`<`, `>`). Completely eliminates `localeCompare` overhead, dropping sort time for 1,000,000 rows from ~40 seconds to under 80 milliseconds.
- **Excel-Style Filter Popover Virtualization**: Autofilter checklist is capped at 10,000 distinct items (matching Microsoft Excel's autofilter ceiling) with top/bottom spacers, rendering only ~15 DOM checklist items regardless of distinct value count.
- **Zero-Copy Memory Transfer**: File `ArrayBuffer` transferred to Web Worker via Transferable Objects.

## 3. Tech Stack & Architecture
- **Framework**: Pure HTML5, Vanilla JavaScript (ES modules), and Vanilla CSS (custom design tokens).
- **Architecture**: Web Worker multi-threaded architecture (`main.js` UI thread + `worker.js` data engine).
- **Build tool**: Vite (`vite build`, `--base` support for GitHub Pages).
- **Libraries**:
  - `xlsx`: Pure JavaScript spreadsheet parser running in Web Worker.
- **Deployment**: GitHub Pages via GitHub Actions workflow (`deploy-web-pages.yml`).
