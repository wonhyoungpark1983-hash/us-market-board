# realtime-api Design Document

> **Summary**: 수동 Refresh 및 일일 자동 8 AM 동기화를 지원하는 바닐라 JS 기반 시장 데이터 API 연동 설계
>
> **Project**: 미국 시황 대시보드
> **Version**: 1.0.0
> **Author**: Claude (Anthropic)
> **Date**: 2026-02-22
> **Status**: Draft
> **Planning Doc**: [realtime-api.plan.md](../01-plan/features/realtime-api.plan.md)

---

## 1. Overview

### 1.1 Design Goals

1. **무료 API 적극 활용 및 Rate Limit 방어**: 브라우저 캐시 및 갱신 시간 제한(오전 8시 기점)을 통해 API 호출 최적화.
2. **이식성 높은 코드 (Vanilla JS)**: 별도의 빌드 도구나 모듈 번들러 없이 기존 HTML에서 즉시 동작하는 `<script>` 기반 모듈화 구현.
3. **견고성 (Robustness)**: 네트워크 오류 시 UI 레이아웃이 깨지지 않도록 Fail-safe(예비 데이터) 구현.

### 1.2 Design Principles

- **Separation of Concerns**: API 통신/파싱(Service) 부분과 DOM 직접 제어(UI) 부분을 함수 레벨에서 분리.
- **Fail Gracefully**: 데이터 호출에 실패했을 때, 사용자에게 에러 상황을 인지시키되 이전 데이터를 통해 맥락은 유지.

---

## 2. Architecture

### 2.1 Component Diagram

```text
┌─────────────────────────┐               ┌────────────────────┐
│      Browser Client     │               │  Public API (CORS) │
│                         │   HTTP GET    │                    │
│   [Refresh Button] ─────┼──────────────▶│ - Yahoo Finance    │
│                         │               │ - Alpha Vantage    │
│   [LocalStorage] ◀──────┼─(JSON Parse)──│                    │
│        │                │               └────────────────────┘
│        ▼                │
│   [DOM Renderer]        │
└─────────────────────────┘
```

### 2.2 Data Flow

1. 초기 페이지 로드
2. `checkAndUpdateData()` 함수 실행
3. `LocalStorage` 조회: 
   - 마지막 동기화 시간이 오늘 오전 8시 이후인가? -> **YES**: 통과 (캐시 렌더 유지)
   - **NO**: API 비동기 호출
4. 'Refresh' 버튼 클릭 시: 강제 API 호출
5. API 응답 처리 -> `LocalStorage` 업데이트 -> DOM 요소 값 변경(렌더링)
6. API 에러 시: 토스트 알림 표시 및 기존 데이터 유지

---

## 3. Data Model

### 3.1 LocalStorage Schema (Cache)

```json
{
  "us_market_last_sync": 1708680000000, // Unix Timestamp (ms)
  "us_market_data": {
    "indices": {
      "SP500": { "price": 6854.0, "changePercent": -0.47 },
      "NASDAQ": { "price": 22312.0, "changePercent": -0.51 }
      // ...
    },
    // 환율, 원자재 등 동일 구조
  }
}
```

---

## 4. API Specification

### 4.1 Endpoint List (Yahoo Finance Unofficial 예시)

| Method | Path | Description | Note |
|--------|------|-------------|------|
| GET | `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}` | 각 티커의 최신 종가 및 변동량 | 무료, CORS 간헐적 이슈 가능 (CORS Proxy 필요시 대체 API 검토) |

> **대안 API (Alpha Vantage, Finnhub 등)**:
> - Yahoo Finance CORS 제약 발생 시, CORS가 열려있는 공개 API로 Fallback 로직 혹은 공개 프록시 활용 검토.

---

## 5. UI/UX Design

### 5.1 Screen Layout

- **Header Area**: 기존 로고 우측에 작게 `[↻ Refresh]` 스타일의 버튼 추가.
- **Last Updated Text**: "마지막 동기화: 2026.02.22 08:05" 형태의 라벨 추가.

---

## 6. Error Handling

### 6.1 Error Response format

CORS 나 네트워킹 타임아웃, 429 Too Many Requests 에러가 발생 시 `catch` 블록에서 다음을 수행:
1. `LocalStorage`의 이전 데이터를 기반으로 화면 복구.
2. 스크린 상단이나 하단에 작게 에러 알림 토스트 3초 노출 ("최신 데이터를 불러오지 못했습니다. 이전 데이터를 표시합니다.")

---

## 7. Implementation Guide

### 7.1 File Structure

기존 단일 HTML 파일 내에 포함하거나, 별도의 `js/market-api.js` 파일을 생성해 삽입합니다.

```
files/
├── us_market_daily_v2.html  (DOM 요소 식별자 반영, script 태그 추가)
├── market_mobile.html       (동일)
└── js/
    └── market-api.js        (새로운 바닐라 로직 분리)
```

### 7.2 Implementation Order

1. [ ] DOM 요소에 고유 속성(예: `data-ticker="^GSPC"`) 부여
2. [ ] `js/market-api.js` 생성: API Fetch 로직 작성 (Yahoo/Alpha Vantage)
3. [ ] `js/market-api.js` 내 LocalStorage 저장 및 8시 체크 로직 작성
4. [ ] Refresh 버튼 이벤트 리스너 연동
5. [ ] 데스크톱 및 모바일 버전에 작성한 스크립트 `<script src="...">` 태그 추가

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-22 | Initial draft | Claude |
