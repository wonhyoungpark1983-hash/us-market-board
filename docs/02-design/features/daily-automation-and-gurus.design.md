---
template: design
version: 1.2
description: PDCA Design phase document template for daily automation and gurus
variables:
  - feature: daily-automation-and-gurus
  - date: 2026-02-22
  - author: Antigravity Assistant
  - project: US Market Board
  - version: 1.0.0
---

# daily-automation-and-gurus Design Document

> **Summary**: Design for GitHub Actions automatic data updates and UI addition for new Guru Portfolios
>
> **Project**: US Market Board
> **Version**: 1.0.0
> **Author**: Antigravity Assistant
> **Date**: 2026-02-22
> **Status**: Draft
> **Planning Doc**: [daily-automation-and-gurus.plan.md](../01-plan/features/daily-automation-and-gurus.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **Automation without Servers**: Move market data fetching logic from the client to a scheduled GitHub Action that runs daily, fetching market indices and updating a static JSON file.
2. **Expand Content**: Properly display latest 13F fillings for Michael Burry and Stan Druckenmiller alongside existing Buffet and ARK sections.

### 1.2 Design Principles

- **Zero Cost**: Leverage GitHub Actions and GitHub Pages. No backend servers required.
- **Fail-safe**: If the Action fails or misses a run (e.g. Yahoo Finance 429 errors), the dashboard gracefully loads the last generated `data.json`.
- **Decoupled Architecture**: Separation of concerns between Node.js scrapper script, GitHub Actions YML, and Dashboard Vanilla JS UI.

---

## 2. Architecture

### 2.1 Component Diagram

```
┌────────────────────┐      ┌──────────────────────────┐      ┌──────────────┐
│   GitHub Actions   │─────▶│ data-fetcher.js (Node)   │─────▶│ Yahoo API    │
│   (Cron: Daily)    │      │ Parses and formats data  │      │ EDGAR / Web  │
└────────────────────┘      └──────────────┬───────────┘      └──────────────┘
                                           │
                                           ▼
┌────────────────────┐      ┌──────────────────────────┐
│   market-api.js    │◀─────│ data.json (Committed)    │
│   (Client-side)    │      │ Static JSON file in Repo │
└─────────┬──────────┘      └──────────────────────────┘
          │
          ▼
┌────────────────────┐
│  market_mobile.html│
└────────────────────┘
```

### 2.2 Data Flow

1. GitHub Actions triggered (cron: 21:00 UTC).
2. Action runs `node scripts/fetch-data.js`.
3. Script fetches market summary from external APIs.
4. Script overwrites `files/data/market_data.json`.
5. Action commits the changed JSON back to the repository.
6. User visits GitHub Pages -> Client JS fetches `data/market_data.json` locally instead of calling external APIs directly.

---

## 3. Data Model

### 3.1 `market_data.json` Structure

```json
{
  "lastUpdated": "2026-02-22T21:00:00Z",
  "indices": {
    "^GSPC": { "price": "6880.00", "changeText": "▲ 0.38%", "changePercent": "+0.38", "status": "up" },
    "^IXIC": { "price": "22450.00", "changeText": "▲ 0.61%", "changePercent": "+0.61", "status": "up" }
    // ...
  }
}
```

---

## 4. GitHub Actions Specification

### 4.1 Workflow Layout

**File:** `.github/workflows/daily-update.yml`

```yaml
name: Daily Market Data Update
on:
  schedule:
    - cron: '30 21 * * 1-5' # Runs at 21:30 UTC, Mon-Fri (After US Market Close)
  workflow_dispatch: # Allows manual trigger

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Run Fetch Script
        run: node scripts/fetch-market-data.js
      - name: Commit and Push
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add files/data/market_data.json
          git commit -m "Auto-update market data" || exit 0
          git push
```

---

## 5. UI/UX Design (Guru Sections)

### 5.1 Component List

The new gurus will be added to the `<section id="gurus">` element in both `market_mobile.html` and `us_market_daily_v2.html`.

| Component | Responsibility |
|-----------|----------------|
| **Stan Druckenmiller Card** | Displays top holdings of Duquesne Family Office (e.g. NVDA, MSFT, COUP). Uses the same `.card` CSS structure as the Buffett div. |
| **Michael Burry Card** | Displays top holdings of Scion Asset Management (e.g. BABA, JD, REAL). Uses the same `.card` CSS structure as the Buffett div. |

---

## 6. Testing Plan

### 6.1 Test Scope

| Type | Target |
|------|--------|
| Workflow Test | Run GitHub Actions manually via `workflow_dispatch` to test the script execution and git commit process. |
| Client Test | Load the HTML files and verify that `fetch('data/market_data.json')` properly applies to the DOM elements. |

---

## 7. Implementation Guide

### 7.1 Key Files to Create/Modify

1.  **`scripts/fetch-market-data.js`**: (New) Node.js script adapted from previous client-side fetch logic.
2.  **`.github/workflows/daily-update.yml`**: (New) GitHub Actions configuration.
3.  **`files/data/market_data.json`**: (New) Dummy JSON structure to be overwritten.
4.  **`files/js/market-api.js`**: (Modify) Change URL from `query2.finance.yahoo.com...` to `./data/market_data.json`.
5.  **`files/market_mobile.html`** & **`files/us_market_daily_v2.html`**: (Modify) Copy-paste the existing Guru card layout and populate with Michael Burry and Stan Druckenmiller holdings.

### 7.2 Implementation Order

1.  Create the `fetch-market-data.js` script and test it locally to generate `data/market_data.json`.
2.  Set up the GitHub Actions `.github/workflows/daily-update.yml` file.
3.  Modify the client-side `market-api.js` to read from the JSON.
4.  Add the new Guru HTML cards to the UI.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-22 | Initial design | Antigravity Assistant |
