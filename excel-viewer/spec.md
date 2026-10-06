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
- **Row numbering**: Fixed leftmost index column `#` for easy referencing.
- **Cell formatting & auto-detection**:
  - Right-aligned monospace presentation for numbers and currencies.
  - Semantic pill tags for common status values (e.g. `Completed`, `Active`, `Pending`, `Cancelled`).
  - Clickable URL links when cell contains valid web addresses.
  - Muted placeholders (`—`) for blank/null values.
  - Click to copy cell value with toast notification.
- **Sticky headers**: Header row remains pinned while scrolling through large datasets.

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
- **Global search**: Instant search input filtering across all visible columns simultaneously.
- **Per-column filtering**: Inline filter inputs below each column header for targeted column-level matching.
- **Filter chips**: Displays currently active column filters with individual remove buttons and a "Clear All" action.
- **Real-time count**: Displays filtered count vs total count (e.g. `Showing 42 of 150 rows`).

### 2.5 Column Visibility
- **Column selector panel**: Dropdown / drawer listing all headers with checkboxes.
- **Quick controls**: "Show All" and "Hide All" (preserving at least 1 column).
- **Search columns**: Quick filter for wide spreadsheets with 20+ columns.
- **Persistence during session**: Hidden columns do not render in header or data cells, but maintain their sorting/filter states when unhidden.

### 2.6 Pagination & Controls
- **Page sizes**: 25, 50, 100, 200, or "All".
- **Pagination controls**: First, Prev, Page indicator, Next, Last, and direct jump to page.
- Keeps DOM node count minimal for 60fps scrolling and rapid interaction on large files.

### 2.7 Export & Utilities
- Export visible / filtered table rows to CSV.
- Copy table data to clipboard.
- Light / Dark theme toggle.

## 3. Tech Stack & Architecture
- **Framework**: Pure HTML5, Vanilla JavaScript (ES modules), and Vanilla CSS (custom design tokens).
- **Build tool**: Vite (`vite build`, `--base` support for GitHub Pages).
- **Libraries**:
  - `xlsx`: Pure JavaScript spreadsheet parser.
  - `lucide`: Clean feather-style UI icons.
- **Deployment**: GitHub Pages via GitHub Actions workflow (`deploy-web-pages.yml`).
