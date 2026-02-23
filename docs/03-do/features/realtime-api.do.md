# realtime-api Implementation Guide

> **Summary**: 수동 Refresh 및 일일 자동 8 AM 동기화를 지원하는 바닐라 JS 기반 시장 데이터 API 연동 구현 가이드
>
> **Project**: 미국 시황 대시보드
> **Version**: 1.0.0
> **Author**: Claude (Anthropic)
> **Date**: 2026-02-22
> **Status**: In Progress
> **Design Doc**: [realtime-api.design.md](../02-design/features/realtime-api.design.md)

---

## 1. Pre-Implementation Checklist

### 1.1 Documents Verified

- [x] Plan document reviewed: `docs/01-plan/features/realtime-api.plan.md`
- [x] Design document reviewed: `docs/02-design/features/realtime-api.design.md`

### 1.2 Environment Ready

- [x] Vanilla JS project (No build tools required)
- [x] Browsers support `localStorage` and `fetch` native API

---

## 2. Implementation Order

> Follow this order based on Design document specifications.

### 2.1 Phase 1: API Logic (`js/market-api.js`)

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 1 | Create file & API Fetch logic | `files/js/market-api.js` | ☐ |
| 2 | Check 8 AM expiration & LocalStorage logic | `files/js/market-api.js` | ☐ |
| 3 | Create DOM updater functions | `files/js/market-api.js` | ☐ |

### 2.2 Phase 2: HTML Integration

| Priority | Task | File/Location | Status |
|:--------:|------|---------------|:------:|
| 4 | Add `data-ticker` to indices | `files/us_market_daily_v2.html`, `market_mobile.html` | ☐ |
| 5 | Insert `[↻ Refresh]` button to Header | `files/us_market_daily_v2.html`, `market_mobile.html` | ☐ |
| 6 | Import `market-api.js` before `</body>` | `files/us_market_daily_v2.html`, `market_mobile.html` | ☐ |

---

## 3. Key Files to Create/Modify

### 3.1 New Files

| File Path | Purpose |
|-----------|---------|
| `files/js/market-api.js` | API 통신, 로컬스토리지 관리, DOM 렌더링을 담당하는 핵심 로직 |

### 3.2 Files to Modify

| File Path | Changes | Reason |
|-----------|---------|--------|
| `files/us_market_daily_v2.html` | HTML에 `data-ticker` 속성 추가 및 JS 로드 | PC 대시보드 API 바인딩 |
| `files/market_mobile.html` | HTML에 `data-ticker` 속성 추가 및 JS 로드 | 모바일 대시보드 API 바인딩 |

---

## 4. Implementation Notes

### 4.1 Design Decisions Reference

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State Management | `localStorage` | 새로고침 시 무분별한 무료 API 호출 방어 |
| API Pattern | `fetch()` | 브라우저 내장(최적화), 의존성 없음 |
| Error Handling | Catch & Fallback | 실패 시 UI 붕괴 방지, 기존 캐시 데이터 반환 |

### 4.2 Code Patterns to Follow

```javascript
// LocalStorage caching pattern
function getCachedData() {
  const cached = localStorage.getItem('us_market_data');
  const lastSync = localStorage.getItem('us_market_last_sync');
  
  if (cached && lastSync) {
    const syncTime = new Date(parseInt(lastSync));
    const now = new Date();
    
    // Check if passed 8:00 AM today
    const current8AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    
    // If sync time is before today's 8 AM AND current time is past 8 AM
    if (syncTime < current8AM && now >= current8AM) {
      return null; // Cache expired
    }
    
    return JSON.parse(cached); // Cache valid
  }
  return null;
}
```

---

## 6. Testing Checklist

### 6.1 Manual Testing (TDD conceptually)

- [ ] Refresh 클릭 시 콘솔에 Fetch 요청이 찍히는지 확인
- [ ] 에러를 유발했을 때 멈추지 않고 하드코딩된 값이 보여지는지 확인
- [ ] 캐시 타임 임의 조작 시 8 AM 조건문이 정상 동작하는지 확인

---

## 8. Post-Implementation

### 8.2 Ready for Check Phase

When all items above are complete:

```bash
# Run Gap Analysis
/pdca analyze realtime-api
```
