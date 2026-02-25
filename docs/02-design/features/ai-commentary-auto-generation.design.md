---
template: design
version: 1.2
description: PDCA Design phase document for AI Commentary Auto-Generation
variables:
  - feature: ai-commentary-auto-generation
  - date: 2026-02-25
  - author: Antigravity Assistant
  - project: US Market Board
  - version: 1.0.0
---

# ai-commentary-auto-generation Design Document

> **Summary**: Google Gemini API를 활용하여 매일 수집된 시장 지표 기반의 시황 해설(Commentary)을 JSON 포맷으로 생성 및 연동하는 구조 설계
>
> **Project**: US Market Board
> **Version**: 1.0.0
> **Author**: Antigravity Assistant
> **Date**: 2026-02-25
> **Status**: Draft

---

## 1. Architecture Design

### 1.1 System Context

기존의 `fetch-market-data.js` 실행 (지수 및 13F 데이터 수집 완료)
➡️ **(신규)** Google Gemini API 호출 (수집된 지표를 프롬프트에 주입)
➡️ JSON 응답 파싱 및 `market_data.json` 포맷 병합
➡️ 변경된 `market_data.json`을 GitHub Repository에 커밋
➡️ 정적 웹 호스팅 (클라이언트는 JSON만 로드하여 화면에 렌더링)

### 1.2 Component Design

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| Data Fetcher | 기존 야후 파이낸스 데이터 수집 | `yahoo-finance2` (Node.js) |
| AI Generator | 시장 지표를 바탕으로 시황 요약글 생성 | `@google/genai` (Node.js) |
| Data Model | 프론트엔드 소비용 JSON 통합 저장 | JSON File I/O (`fs`) |
| UI Renderer | 업데이트된 JSON 데이터를 받아 DOM 최신화 | Vanilla JS (`market-api.js`) |

---

## 2. Interface Specifications

### 2.1 API Design

**외부 연동 API: Google Gemini API (gemini-2.5-flash)**
- **입력 (Prompt)**: 수집된 지수 데이터 (S&P 500, NASDAQ, VIX, WTI 수치 및 등락률)와 날짜 컨텍스트.
- **출력 (Expected)**: Structured JSON Format.
- **포맷 강제**: 모델 설정에 `response_mime_type: "application/json"`을 사용하여 스키마 붕괴(hallucination) 방지.

### 2.2 Data Models

`market_data.json`의 확장을 위한 JSON Schema 설계:

```typescript
// 추가될 commentary 필드 구조
interface MarketCommentary {
  brief: string; // 한 뼘 브리핑 (전체 시황 요약)
  topics: Array<{
    title: string; // 주요 키워드/토픽 제목
    description: string; // 관련 상세 해설
  }>;
  events: Array<{
    date: string; // 형태: '2. 26. (목)'
    description: string; // 이벤트 설명: 'PCE 물가지수 발표 등'
  }>;
}
```

---

## 3. GitHub Actions Specification

`.github/workflows/daily-update.yml`에 환경변수 주입.

```yaml
jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      # ... (checkout, node setup, npm install) ...
      - name: Fetch Market Data and Generate Commentary
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}  # GitHub Secrets
        run: node scripts/fetch-market-data.js
```

---

## 4. UI/UX Design

기존 하드코딩된 HTML 요소를 ID 또는 클래스를 통해 JS에서 제어할 수 있도록 스텁(Stub)화.

- `div.narr-body`: `commentary.brief` 출력
- `.narr-issue`: `commentary.topics` 배열 맵핑 후 리스트 렌더링
- `li` (이벤트 목록): `commentary.events` 배열 맵핑 후 렌더링

### 4.1 Error States / Fallbacks

- API 오류 시: 기존 `market_data.json`에 저장된 이전 일자의 해설을 유지.
- JSON 파싱 실패 시: "오늘의 시황을 불러오는 중 오류가 발생했습니다." 폴백 메시지 출력.

---

## 5. Security & Configuration

- **API Key 관리**: `@google/genai` SDK는 `.env` 파일 또는 환경변수 `GEMINI_API_KEY`를 참조. 레포지토리 코드 내에 키가 절대로 포함되지 않도록 `dotenv` 사용 및 `.gitignore` 설정 점검.
- **GitHub Secrets**: 운영 환경에서는 GitHub Secrets 메뉴에 키 등록 필수.

---

## 6. Implementation Guide

1. `package.json`에 `@google/genai` 의존성 추가
2. `scripts/fetch-market-data.js` 내에 Gemini API 호출 함수 `generateCommentary(marketData)` 추가.
3. `system_instruction` 또는 메인 `prompt` 작성 (제약 조건: "투자 조언이 아니며, 객관적 사실만 JSON 포맷으로 요약해라")
4. 클라이언트 스크립트 수정 (`market-api.js` 내부 DOM 바인딩 로직)
5. `npm run dev` (가정) 또는 `node scripts/fetch-market-data.js` 로컬 테스트.
6. `daily-update.yml`에 `GEMINI_API_KEY` 연동 확인 후 커밋 반영.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-25 | Initial design | Antigravity Assistant |
