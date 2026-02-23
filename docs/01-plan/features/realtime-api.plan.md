# realtime-api Planning Document

> **Summary**: 수동 Refresh 버튼 클릭 및 매일 아침 8시 자동 스케줄링을 통한 주식, 환율, 원자재 API 데이터 연동
>
> **Project**: 미국 시황 대시보드
> **Version**: 1.0.0
> **Author**: Claude (Anthropic)
> **Date**: 2026-02-22
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose
하드코딩된 정적 데이터를 대체하여, 사용자가 원할 때(Refresh 버튼 클릭) 또는 매일 아침 8시에 맞춰 최신 시장 데이터를 API를 통해 가져와 대시보드에 반영하도록 합니다.

### 1.2 Background
현재 대시보드는 특정일 마감 기준 데이터로 하드코딩되어 있습니다. 사용자가 수동으로 매번 데이터를 업데이트하는 불편을 개선하기 위해, Refresh 버튼을 통한 수동 동기화 및 자정~아침 사이(8 AM 등)의 배치 처리를 통한 자동 업데이트 환경이 필요합니다.

### 1.3 Related Documents
- Requirements: `files/프로젝트_인수인계.md`
- References: Alpha Vantage API / Yahoo Finance API (unofficial) 문서

---

## 2. Scope

### 2.1 In Scope
- [x] 주요 지수(S&P 500, NASDAQ, DOW, VIX, Russell 2000) 데이터 API 연동
- [x] 환율(USD/KRW, DXY 등), 원자재(WTI, 금 등) 및 크립토(BTC 등) 데이터 연동
- [x] API 통신 지연 혹은 한도 초과(Rate Limit) 등의 에러 시 기존 하드코딩 데이터(또는 직전 로컬 캐시)로 표시되도록 Fallback 처리
- [x] 브라우저 LocalStorage에 마지막 동기화 시간과 데이터를 저장하여, 페이지 로드 시 불필요한 자동 API 호출 방지
- [x] 헤더 영역에 'Refresh' 버튼 추가 및 클릭 시 API 최신화 트리거 설계
- [x] 매일 아침 8시에 맞춰 자동 최신화 배치 연동 혹은 조건부 자동 데이터 Fetch (사용자가 8시 이후 최초 접속 시 1회 갱신)

### 2.2 Out of Scope
- 워런 버핏 및 ARK 매매 내역 등 공시나 별도의 스크래핑이 필요한 데이터의 자동화 (이 부분은 후속으로 분리 진행)
- 페이지 접속 시마다 무조건 발생하는 실시간 자동 Fetch (새로고침 시 렌더링 이슈 방지)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | UI 상단에 'Refresh (동기화)' 버튼을 추가하고, 클릭 시 API 통신 트리거 | High | Pending |
| FR-02 | 응답받은 데이터를 파싱하여 HTML DOM의 각 요소(가격, 등락률 등)에 동적 업데이트 | High | Pending |
| FR-03 | 브라우저 LocalStorage 캐싱을 사용하여, 페이지 로딩 시 캐시된 데이터를 우선 출력 | Medium | Pending |
| FR-04 | 매일 08:00 AM 이후, 전일자 데이터가 존재할 경우 API를 백그라운드에서 갱신하는 로직 추가 | Medium | Pending |
| FR-05 | API 응답 에러 발생 시 UI가 깨지지 않고 Fallback 데이터를 보여주고 경고 토스트 표시 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | API 로딩 전 기존 HTML 뼈대 및 캐시 데이터는 즉각 렌더링 유지 (Refresh 클릭 전까지 비동기 미동작) | Lighthouse / Network 탭 |
| Reliability | 무료 API의 Rate Limit에 의한 차단을 방지할 수 있어야 함 | 로컬스토리지 만료 로직 검증 |

---

## 4. Success Criteria

### 4.1 Definition of Done
- [ ] 데스크톱(`us_market_daily_v2.html`) 및 모바일(`market_mobile.html`) 화면에 API 기반 fetch 로직 적용
- [ ] Vanilla JavaScript (혹은 모듈 방식) 로직 구현 완료
- [ ] 헤더 영역에 동기화(Refresh) 버튼 UI/Interaction 구현
- [ ] 브라우저 로딩 시 매일 오전 8시가 지났는지 판별하는 조건문 로직 개발 (+이전 캐시와 비교)
- [ ] 브라우저 콘솔에서 CORS 등 에러 없이 정상 구동됨

### 4.2 Quality Criteria
- [ ] 빈번한 새로고침 시에도 오직 수동 Refresh 버튼이나 8시 정각 이후 최초 1회에만 API가 호출됨을 검증
- [ ] JS 코드가 재사용 가능하도록 함수 또는 클래스 기반으로 정리되어 있음

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 브라우저 CORS 에러 | High | High | 프론트엔드 환경에서 호출 가능한 API(CORS 허용)를 선정하거나 프록시 사용 검토 |
| API Rate Limit 초과 (무료 API) | Medium | High | 캐싱 주기를 길게(예: 10분~1시간) 잡거나 복수의 API 키 활용 (설계 단계 결정) |
| API 제공자의 URL/포맷 변경 | Low | Low | API 연동 모듈을 별도 JS 파일/함수로 분리하여 변경에 대한 여파 최소화 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | [x] |
| **Dynamic** | Feature-based modules, services layer | Web apps with backend, SaaS MVPs | [ ] |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | [ ] |

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Vanilla HTML/JS / React | Vanilla JS | 기존 구현물이 정적 HTML이므로, 이식성 및 빠른 도입을 위해 바닐라 JS 사용 |
| State Management | Local variables / LocalStorage | LocalStorage | 반복되는 재접속 시 무료 API 호출 방어용 데이터 임시 저장소 목적 |
| API Client | fetch / axios | fetch | 추가 라이브러리(CDN) 의존성을 없애고 성능 최적화를 위해 브라우저 네이티브 사용 |

---

## 8. Next Steps

1. [ ] Write design document (`realtime-api.design.md`) - 구체적 API 선정 및 응답 구조 정의
2. [ ] 리뷰 후 사용자 승인 받기
3. [ ] Start implementation (`files/` 내 HTML에 스크립트 접목)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-22 | Initial draft | Claude |
