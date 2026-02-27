---
type: plan
feature: skill-market-data-automation
status: draft
createdAt: "2026-02-27T15:43:00+09:00"
updatedAt: "2026-02-27T15:43:00+09:00"
---

# Plan: 신규 스킬 (Market Data Automation) 등록 계획서

## 1. 개요 (Overview)
본 계획서는 이전에 성공적으로 구현한 **"GitHub Actions 기반 정적 데이터 자동 수집 및 프론트엔드 동적 바인딩(캐시 포함)"** 기술을 재사용 가능한 Agent Skill로 패키징하여 등록하는 과정을 정의합니다. 이 스킬이 등록되면 향후 유사한 대시보드나 데이터 연동 작업 시 빠르고 완벽하게 패턴을 적용할 수 있습니다.

## 2. 목표 (Goals)
- **표준화된 스킬 문서(`SKILL.md`) 작성**: 시장 데이터 수집 자동화 및 UI 업데이트의 모범 사례 명문화.
- **예제 코드 제공**: 스크립트(`fetch-market-data.js`), 프론트엔드 바인딩(`market-api.js`), 워크플로우(`.github/workflows`) 템플릿화.
- **오류 방지 가이드 포함**: 기호($, %) 증발 방지 로직 및 로컬 스토리지 캐시 무효화 전략 명시.

## 3. 구현 계획 (Implementation Details)

### 3.1. 스킬 구조 설계
`.agent/skills/market-data-automation/` 디렉토리를 생성하고 다음 파일들을 구성합니다.

- `SKILL.md`: 스킬의 핵심 가이드 및 프롬프트 트리거 (트리거: `market data automation`, `github actions data fetch`, `정적 데이터 자동화` 등)
- `templates/` (선택적 디렉토리):
    - `fetch-script.js.template`: Node.js 기반 데이터 수집 샘플 스크립트.
    - `frontend-api.js.template`: 캐시 및 DOM 자동 업데이트 샘플 스크립트.
    - `workflow.yml.template`: GitHub Actions 스케줄러 템플릿.

### 3.2. 핵심 지침 (SKILL.md 주요 내용)
1. **아키텍처**: "직접 API 호출"이 아닌 "Actions 수집 -> 정적 JSON 배포 -> 클라이언트 Fetch" 패턴을 강제.
2. **DOM 바인딩 원칙**: 
    - `data-ticker` 같은 식별자를 사용하여 HTML과 분리.
    - `textContent` 덮어쓰기 시 기존 단위 기호($, %, bp) 보존 보장 로직 필수 적용.
3. **캐시 관리 전략**:
    - `localStorage`를 활용하여 API 호출(정적 파일 요청) 최적화.
    - 데이터 구조 변경 시 캐시 키 버저닝(`v1` -> `v2`)을 통한 강제 무효화 방식 지시.

## 4. 진행 단계 (Milestones)
- [ ] **Step 1**: `.agent/skills/market-data-automation/` 폴더 생성 및 `SKILL.md` 초안 작성.
- [ ] **Step 2**: 이전 프로젝트에서 사용한 핵심 로직을 추출하여 예제(템플릿) 코드로 작성.
- [ ] **Step 3**: Agent의 전역 지침서(`GEMINI.md`) 목록에 신규 스킬 추가 (트리거 키워드 포함).

## 5. 예상 결과물 (Expected Deliverables)
- `.agent/skills/market-data-automation/SKILL.md` 등 파일 일체
- 업데이트된 `GEMINI.md` 스킬 리스트
