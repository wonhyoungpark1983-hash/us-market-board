---
template: plan
version: 1.2
description: PDCA Plan phase document for AI Commentary Auto-Generation
variables:
  - feature: ai-commentary-auto-generation
  - date: 2026-02-25
  - author: Antigravity Assistant
  - project: US Market Board
  - version: 1.0.0
---

# ai-commentary-auto-generation Planning Document

> **Summary**: LLM (OpenAI/Gemini) API를 연동하여 매일 최신 시장 지표와 뉴스를 바탕으로 시황 해설(Commentary) 섹션을 자동 생성하는 파이프라인 구축
>
> **Project**: US Market Board
> **Version**: 1.0.0
> **Author**: Antigravity Assistant
> **Date**: 2026-02-25
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 US Market Board 대시보드의 "숫자(지수, 가격 등)"는 매일 자동 수집되지만, "해설(텍스트)" 영역은 하드코딩되어 있습니다. 이를 자동화하기 위해 LLM API를 도입하여, 매일 수집된 시장 데이터를 기반으로 시황 브리핑, 주요 토픽 4개, 내일의 주목 이벤트를 자동 작성하여 JSON 형식으로 저장하고 화면에 렌더링하는 것을 목표로 합니다.

### 1.2 Background

매일 수동으로 시황을 분석하고 HTML에 하드코딩하는 방식은 유지보수 비용이 높고 휴먼 에러의 가능성이 있습니다. LLM을 활용하면 최소한의 비용으로 양질의 텍스트 콘텐츠를 매일 자동으로 생성할 수 있습니다.

### 1.3 Related Documents

- OpenAI / Gemini API Documentation
- GitHub Actions Documentation
- `docs/01-plan/features/daily-automation-and-gurus.plan.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] LLM API (OpenAI 또는 Gemini 등 사용자 선택) 연동을 위한 Node.js 스크립트 확장 (`scripts/generate-commentary.js` 또는 `fetch-market-data.js` 통합)
- [ ] 프롬프트 엔지니어링 수행 (데이터 주입 시 포맷, 출력 JSON 제약 등 설정)
- [ ] 일일 자동화 GitHub Actions 파이프라인에 LLM 스크립트 실행 단계 추가
- [ ] 요약된 해설 데이터를 저장할 JSON 구조 설계 (`market_data.json` 내 `commentary` 필드 추가)
- [ ] 클라이언트 사이드 (`market-api.js`, `market_mobile.html`)에서 JSON 기반 해설 섹션 동적 렌더링 로직 구현

### 2.2 Out of Scope

- 사용자가 직접 대시보드 화면 내에서 프롬프트를 수정하거나 대화형 인터페이스를 제공하는 기능
- 유료 뉴스 API 결제가 필요한 실시간 속보 스크래핑 (무료 API 또는 웹 크롤링 한도 내 진행)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 매일 시장 데이터 수집 완료 직후 LLM 프로세스가 실행되어야 함 | High | Pending |
| FR-02 | LLM 프롬프트에 시장 데이터 콘텍스트(주요 지수, VIX, WTI 등)가 제공되어야 함 | High | Pending |
| FR-03 | LLM 출력은 구조화된 JSON(4개의 토픽, 각 제목/내용 및 내일 이벤트 목록 등) 형태여야 파싱이 가능함 | High | Pending |
| FR-04 | 갱신된 내역은 `market_data.json`에 반영 후 GitHub 스케줄러를 통해 커밋되어야 함 | High | Pending |
| FR-05 | `market_mobile.html`과 `us_market_daily_v2.html`의 해설(Page 5) 탭 UI가 JSON 텍스트를 파싱하여 DOM에 출력하도록 수정되어야 함 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| API Cost | 하루 1회 호출로 LLM 비용 최소화 | Dashboard Billing |
| Fault Tolerance | LLM API 장애(Timeout 등) 시 기존 해설 데이터를 유지 (페이지 빈 공간 방지) | Error Logging |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] LLM 시스템 프롬프트 작성 완료 및 예상 포맷 검증
- [ ] GitHub Actions 로직 추가 완료 및 테스트 패스
- [ ] 로컬/운영 환경에서 LLM 연동 후 시황 탭 하드코딩 영역이 동적 텍스트로 치환됨을 확인
- [ ] Design, Analysis, Report (PDCA) 문서 산출

### 4.2 Quality Criteria

- [ ] 프롬프트 환각(Hallucination) 방지를 위한 Context Injection 최적화
- [ ] JSON 포맷팅 에러 발생률 0% 지향 (JSON Mode 지원 적용 권장)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM 답변 형식 오류 (JSON 파싱 실패) | High | Medium | Zod 스키마, Structured Outputs 강제 또는 `JSON.parse` 예외 처리 후 Fallback 데이터 표시 |
| API 키 노출 | High | Low | GitHub Repository Secrets 기능을 활용하여 은닉 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, services layer | Web apps with backend, SaaS MVPs | ☑ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

*주: 외부 AI API와의 연동이 포함되므로 Dynamic 레벨에 준하는 상태 관리와 환경 변수 처리 필요

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| **LLM Provider** | OpenAI / Gemini / Claude | TBD 사용자 환경에 따름 | 사용자가 발급한 API 키에 따라 결정 필요 |
| **Data Format** | Markdown 파일 생성 / JSON 내장 | `market_data.json` 확장 | 단일 HTTP 요청으로 지수와 텍스트를 클라이언트에 동시 확보 |

---

## 7. Next Steps

1. [ ] LLM API Provider 결정 (사용자와 협의: OpenAI vs Gemini 등)
2. [ ] Write design document (`ai-commentary-auto-generation.design.md`) - 프롬프트, JSON 스키마 설계
3. [ ] 프론트엔드 DOM 출력 패턴 기획

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-25 | Initial setup | Antigravity Assistant |
