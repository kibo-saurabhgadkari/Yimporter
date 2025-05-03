# Yimporter Requirements Document

## 1. Objectives

- **Automate Statement Conversion:** Reduce manual effort by parsing CSV, Excel, and PDF bank statements into the YNAB CSV template (Date, Payee, Memo, Outflow, Inflow).
- **User Review Interface:** Provide an interactive preview UI for inline edits before export.
- **Maintainable PRD:** Keep the PRD live in GitHub—easily updateable and auditable as development progresses.

## 2. Scope

### In-Scope Features
- **Multi-file Upload:** Accept multiple CSV, XLSX, and PDF uploads in one session.
- **Parsing Modules:**
  - CSV/Excel via EPPlus or CsvHelper (C#) / pandas/openpyxl (Python).
  - PDF table extraction via iText7/pdfplumber, with OCR fallback using Tesseract.
- **Data Mapping & Transformation:** Standardize to YNAB fields with configurable mappings.
- **Preview & Edit:** Render transactions in an ag-Grid or DataTables component for validation.
- **Export:** Downloadable UTF-8 CSV ready for YNAB import.

### Out-of-Scope
- Automatic bank-login or API integrations.
- Machine-learning categorization (no categories in YNAB import).

## 3. Functional Requirements

### 3.1 File Upload
- Drag-and-drop & selection via Angular's `<input type="file" multiple>`.
- Validate file types (.csv, .xls[x], .pdf) and size limits (≤10 MB).

### 3.2 Parsing Engine
- **CSV/Excel:** Read rows, normalize headers, detect credit/debit columns.
- **PDF Extraction:**
  - Structured: Table detection and parsing.
  - Scanned: Convert to images, then OCR.

### 3.3 Data Transformation
- Ensure Date in ISO format, separate Outflow/Inflow, populate Payee & Memo.
- Config file for custom bank schemas (e.g., column names mapping).

### 3.4 User Review & Export
- Present transactions in a grid with inline editing, sorting, and filtering.
- "Select all" and bulk-edit actions.
- Export button to generate final CSV.

## 4. Non-Functional Requirements
- **Performance:** Parse up to 1,000 transactions in <30 s.
- **Security:** Sanitize uploads; store files only transiently.
- **Scalability:** Modular parser pipeline for easy addition of new bank formats.
- **Usability:** Responsive design using Angular Material or Bootstrap.

## 5. GitHub Repository Structure & Maintenance

### 5.1 Repository Setup
- Private repo (to protect financial logic).
- Top-level folders:
  ```
  /docs       ← PRD, design assets, user guides  
  /src        ← source code  
  /tools      ← parsing scripts, OCR configs  
  /ci         ← Dockerfiles, CI/CD workflows  
  ```
- README.md: Project overview, setup instructions, contribution guidelines.

### 5.2 Documentation in GitHub
- Store the live PRD as docs/PRD.md, updated via pull requests.
- Use Markdown heading conventions and a Table of Contents for navigation.
- Add a CHANGELOG.md to track PRD revisions.

## 6. Issue & PR Templates

### 6.1 Issue Templates
- Feature Request: Title, description, acceptance criteria, priority, estimate.
- Bug Report, Task: Standard fields for reproducibility or task context.
- Store under .github/ISSUE_TEMPLATE/.

### 6.2 Pull Request Template
- Checklist: "Closes #Issue", tests added, documentation updated, reviewer notes.
- Encourage linking PRs to issues for traceability.

## 7. Project Planning with GitHub Projects (Beta)
- Next Gen Project named "MVP Roadmap".
- Views:
  - Board ("To Do", "In Progress", "Review", "Done").
  - Table with custom fields: Type, Priority, Estimate, Module.
  - Roadmap showing milestones (e.g., PoC, Beta, MVP Launch).
- Automations:
  - New issues auto-add to "To Do" column.
  - Issue → In Progress when assigned; → Done when closed.

## 8. Milestones & Releases
- Milestones for each phase:
  - Phase 1 PoC (file upload + CSV parsing)
  - Phase 2 PDF/OCR
  - Phase 3 UI & export
- Assign issues to milestones; track progress via the Milestones view.

## 9. CI/CD & Automation
- GitHub Actions workflows for:
  - Linting & Tests on PRs.
  - Docker build & push on merge to main.
  - Project-beta-automations action to sync Issues/PRs with project board columns.