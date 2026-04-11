# IT 회사 경영 시뮬레이션 게임 - 기획 문서

> '게임 개발 스토리'와 유사한 IT 회사 경영 시뮬레이션 게임
> 기본 단위: 1턴 = 1주일 / 돈 단위: 만원

---

## 문서 구조

### [게임 시스템 (game-system)](./game-system/README.md)

게임이 **어떻게 작동하는지** — 메커니즘, 규칙, 흐름을 다룹니다.

| 문서 | 설명 |
|------|------|
| [게임 진행](./game-system/game-process.md) | 턴 구조, 페이즈, 행동 피로도, 쿨타임, 시작 시나리오, 난이도 수정자 |
| [경제 시스템](./game-system/game-economy.md) | 수입/지출 계산, 재무 건전성, 런웨이 |
| [프로젝트 시스템](./game-system/game-project.md) | 외주/자체서비스 진행, 업무 배분, 기술 부채 |
| [케미스트리 시스템](./game-system/game-chemistry.md) | 팀 케미, 개인 간 케미, 문화 태그 |
| [조직 구조](./game-system/game-organization.md) | 회사 성장, 팀 분리, 채용/해고 메커니즘 |
| [이벤트 시스템](./game-system/game-event.md) | 3레이어 이벤트, 연쇄 효과, 외부 이벤트 |
| [엔딩 시스템](./game-system/game-ending.md) | 실패 조건, 멀티 엔딩, 히든 엔딩 |
| [UI/시스템 설계](./game-system/game-ui.md) | 대시보드, 저장/로드, 튜토리얼 |

### [게임 도메인 (game-domain)](./game-domain/README.md)

게임에 **무엇이 존재하는지** — 엔티티, 개념, 용어를 정의합니다.

| 문서 | 설명 |
|------|------|
| [회사](./game-domain/company.md) | 회사 프로필, 카테고리, 성장 단계 |
| [대표(CEO)](./game-domain/player.md) | 대표 스탯 정의 및 성장 |
| [채용/직군](./game-domain/career.md) | 고용 형태, 직군, 이력서 시스템 |
| [특성](./game-domain/trait.md) | 업무/사회성/성장/리스크 특성, 충돌/시너지 조합 |
| [투자](./game-domain/invest.md) | 투자 라운드, 투자사 기대치 |
| [수입원](./game-domain/revenue.md) | 외주 계약, 서비스 유형, 추가 수입원 |
| [지출](./game-domain/cost.md) | 연봉, 운영비, 복지, 마케팅 |
| [이벤트 카탈로그](./game-domain/event-catalog.md) | 시장 트렌드, 법규제, 랜덤 이벤트 목록 |
| [기술](./game-domain/tech.md) | 기술 부채 레벨, 리팩토링 프로젝트 |

### [MVP 코어 루프](./mvp-core-loop.md)

최소한의 게임 플레이 가능 범위 정의 — 구현 우선순위와 밸런스 기준

---

## 문서 작성 규칙

- **언어**: 한국어 (코드 구현 시 참조할 키워드/변수명은 영어 병기)
- **상호 참조**: 상대 경로 markdown 링크 사용
  ```markdown
  자세한 내용은 [특성 시스템](./game-domain/trait.md)을 참조하세요.
  ```
- **수치**: 밸런스 수치(연봉 범위, 확률 가중치 등)는 문서에 직접 기입
- 각 문서 하단에 **관련 문서** 섹션으로 참조 링크를 모아둠

---

## 핵심 설계 철학

> **레퍼런스: 프로젝트 좀보이드(Project Zomboid)**

세 가지 레이어 구조로 예측 불가능한 재미를 만든다:

| 레이어 | 비중 | 역할 |
|--------|------|------|
| 결정론적 (Deterministic) | 40% | 학습 가능한 인과관계 — 전략 수립의 토대 |
| 확률적 (Probabilistic) | 35% | 조건부 확률 발동 — 긴장감과 반복 플레이의 재미 |
| 연쇄 효과 (Chain Reaction) | 25% | 반직관적 결과 — 기억에 남는 순간 |

자세한 내용은 [이벤트 시스템](./game-system/game-event.md)을 참조하세요.
