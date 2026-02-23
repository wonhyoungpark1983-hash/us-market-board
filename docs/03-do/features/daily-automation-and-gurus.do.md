---
template: do
version: 1.0
description: PDCA Do phase implementation guide template
variables:
  - feature: daily-automation-and-gurus
  - date: 2026-02-22
  - author: Antigravity Assistant
  - project: US Market Board
  - version: 1.0.0
---

# daily-automation-and-gurus Implementation Guide

> **Summary**: Implementation of GitHub Actions based market data auto-updater and adding Druckenmiller & Burry portfolios.
>
> **Project**: US Market Board
> **Version**: 1.0.0
> **Author**: Antigravity Assistant
> **Date**: 2026-02-22
> **Status**: In Progress
> **Design Doc**: [daily-automation-and-gurus.design.md](../../02-design/features/daily-automation-and-gurus.design.md)

---

## 1. Pre-Implementation Checklist

### 1.1 Documents Verified

- [x] Plan document reviewed: `docs/01-plan/features/daily-automation-and-gurus.plan.md`
- [x] Design document reviewed: `docs/02-design/features/daily-automation-and-gurus.design.md`

### 1.2 Environment Ready

- [x] Node.js environment configured (for script execution)
- [x] GitHub repository access confirmed (for Actions setup)

---

## 2. Implementation Order

> Follow this order based on Design document specifications.

### 2.1 Phase 1: Data Backend (Node.js Script)

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 1 | Create dummy JSON structure | `files/data/market_data.json` | ☐ |
| 2 | Write Node.js script for Yahoo API | `scripts/fetch-market-data.js` | ☐ |
| 3 | Test script execution locally | Terminal | ☐ |

### 2.2 Phase 2: Automation (GitHub Actions)

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 4 | Setup GitHub Actions YAML | `.github/workflows/daily-update.yml` | ☐ |

### 2.3 Phase 3: Client Data Logic

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 5 | Modify client fetch to use JSON | `files/js/market-api.js` | ☐ |
| 6 | Integrate manual fallback logic | `files/js/market-api.js` | ☐ |

### 2.4 Phase 4: UI Updates (New Gurus)

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 7 | Add Burry and Druckenmiller cards | `files/market_mobile.html` | ☐ |
| 8 | Add Burry and Druckenmiller cards | `files/us_market_daily_v2.html` | ☐ |

---

## 3. Key Files to Create/Modify

### 3.1 New Files

| File Path | Purpose |
|-----------|---------|
| `files/data/market_data.json` | Static JSON to serve market data to the frontend |
| `scripts/fetch-market-data.js` | Node.js script to run on GitHub Actions |
| `.github/workflows/daily-update.yml` | GitHub Actions definitions |

### 3.2 Files to Modify

| File Path | Changes | Reason |
|-----------|---------|--------|
| `files/js/market-api.js` | Point `fetch()` to local JSON instead of Yahoo Finance directly | To avoid CORS and rate limits on the client |
| `files/market_mobile.html` | Add HTML elements for new gurus | UI Expansion |
| `files/us_market_daily_v2.html` | Add HTML elements for new gurus | UI Expansion |

---

## 4. Dependencies

### 4.1 Required Packages

No external NPM dependencies like `axios` are strictly necessary if native `fetch` (available in Node.js 18+) is used to keep the action fast and simple.

---

## 5. Implementation Notes

### 5.1 Design Decisions Reference

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State Management | LocalStorage + Static JSON | Fast load times and API free. |
| API Pattern | Node Fetch | Use built-in `fetch` in Node.js 18+ to fetch from Yahoo. |
| Error Handling | Client Fallback | If JSON is unreadable, preserve old LocalStorage data. |

### 5.2 Things to Avoid

- [ ] Fetching external APIs directly in JS for standard page loads
- [ ] Changing CSS layouts heavily. Use existing `.card` and `.h-row` layout patterns from the Buffet section.

---

## 6. Progress Tracking

### 6.1 Daily Progress

| Date | Tasks Completed | Notes |
|------|-----------------|-------|
| 2026-02-22 | Implementation guide created | Ready to execute |

---

## 7. Post-Implementation

### 7.1 Ready for Check Phase

When all items above are complete:

```bash
# Run Gap Analysis
/pdca analyze daily-automation-and-gurus
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-22 | Initial implementation start | Antigravity Assistant |
