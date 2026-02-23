---
template: plan
version: 1.2
description: PDCA Plan phase document template with Architecture and Convention considerations
variables:
  - feature: daily-automation-and-gurus
  - date: 2026-02-22
  - author: Antigravity Assistant
  - project: US Market Board
  - version: 1.0.0
---

# daily-automation-and-gurus Planning Document

> **Summary**: GitHub Actions 기반 일일 데이터 자동 갱신 파이프라인 구축 및 신규 대가 포트폴리오(Stan Druckenmiller, Michael Burry) 추가
>
> **Project**: US Market Board
> **Version**: 1.0.0
> **Author**: Antigravity Assistant
> **Date**: 2026-02-22
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

본 기능의 목적은 크게 두 가지입니다:
1. 매일 수동으로 데이터를 갱신하거나 사용자 브라우저 단에서 매번 API를 호출하는 로직을 효율화하기 위해 **GitHub Actions**를 활용한 서버 사이드(빌드 타임) 사전 렌더링 또는 정적 데이터 파일(JSON) 생성 파이프라인을 구축합니다.
2. 기존 워런 버핏, ARK 포트폴리오에 더해 사용자들의 관심도가 높은 **Stan Druckenmiller (Duquesne Family Office)** 및 **Michael Burry (Scion Asset Management)**의 최신 13F 포트폴리오를 대시보드 UI에 추가합니다.

### 1.2 Background

원활하고 일관된 데이터를 제공하기 위해 클라이언트 로컬 스토리지에 지나치게 의존하기보다, 서버 상에서 스케줄링된 파이프라인을 통해 전날(또는 당일 새벽) 마감 데이터를 안정적으로 공급하는 것이 유지보수에 유리합니다.
또한, 다양한 대가들의 포트폴리오를 제공하여 대시보드의 효용 가치를 높이기 위함입니다.

### 1.3 Related Documents

- 13F Filings Data (SEC EDGAR)
- GitHub Actions Documentation

---

## 2. Scope

### 2.1 In Scope

- [x] GitHub Actions 워크플로우(`cron`) 파일 작성 및 설정 (매일 특정 시간 자동 샐행)
- [x] 시장 데이터 및 주요 지표를 가져와 정적 JSON으로 저장하는 스크립트 작성 (Node.js)
- [x] `market_mobile.html` 및 `us_market_daily_v2.html` UI에 신규 대가 섹션(Stan Druckenmiller, Michael Burry) 추가 디자인 반영
- [x] 클라이언트에서 정적 JSON을 호출하여 화면을 그리는 로직 강화 (`market-api.js` 수정 반영)

### 2.2 Out of Scope

- 실시간 WebSocket 기반 초단위 스트리밍
- 백엔드 전용 API 서버 호스팅 (모든 데이터는 GitHub Repository 내부 정적 파일로 처리하여 무료 호스팅 유지)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | GitHub Actions가 평일 매일 미국 마감 시간 이후 자동으로 스크립트를 실행 | High | Pending |
| FR-02 | 스크립트가 실행되어 업데이트된 시장 정보 JSON을 레포지토리에 커밋 | High | Pending |
| FR-03 | 스탠 드러켄밀러 및 마이클 버리의 상위 보유 종목 UI 카드 추가 | Medium | Pending |
| FR-04 | 클라이언트의 `시장 지표` 및 `포트폴리오` 데이터가 자동 갱신된 JSON 데이터를 참조하도록 연동 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 클라이언트 첫 로딩 시 외부 API 직접 호출보다 지연 단축 (JSON 로드) | Network Tab |
| Reliability | 외부 API(Yahoo 등) 에러 발생 시 자동 재시도 로직 포함 | GitHub Actions Logs |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `.github/workflows/daily-update.yml` 파일 생성 및 스케줄링 설정 완료
- [ ] 데이터 수집 스크립트 작동 성공 (수집 폴더 내 `data.json` 생성/갱신)
- [ ] UI에 신규 대가 2인의 포트폴리오 영역 추가 완료
- [ ] GitHub Pages를 통해 배포된 라이브 사이트에서 정상적으로 업데이트 내용 확인

### 4.2 Quality Criteria

- [ ] GitHub Actions 빌드 실패율 0% (스크립트 예외 처리 확보)
- [ ] UI 디자인 레이아웃(반응형 화면) 깨짐 없음

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 13F 또는 Yahoo 파싱 API/라이브러리 구조 변경으로 인한 스크립트 오류 | High | Medium | 에러 발생 시 Actions 알림 수신 설정 및 이전 데이터 보존 로직 추가 |
| GitHub Actions 크론(cron) 작업의 지연 실행 | Medium | High | 시간대에 여유를 두고 동작하게 하며, 클라이언트 fallback 로직 유지 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☑ |
| **Dynamic** | Feature-based modules, services layer | Web apps with backend, SaaS MVPs | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| **Data Fetch Source** | DB Server / Serverless API / Static JSON | Static JSON via GitHub Actions | 비용 무료 (GitHub Pages 연계), 안정적인 프론트엔드 캐싱 활용 용이 |
| **Data Scripting** | Python / Node.js | Node.js | 기존 프론트엔드(`market-api.js`) 자바스크립트 생태계와 통일성 유지 |

---

## 7. Next Steps

1. [ ] Write design document (`daily-automation-and-gurus.design.md`) - 세부 API 선택 및 폴더 구조, GitHub Actions 스텝 설계
2. [ ] 팀 리뷰 및 승인
3. [ ] Start implementation (Phase Do)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-22 | Initial draft | Antigravity Assistant |
