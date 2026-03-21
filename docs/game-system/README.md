# 게임 시스템 (Game System)

게임이 **어떻게 작동하는지** — 메커니즘, 규칙, 흐름을 정의하는 문서입니다.

---

## 문서 목록

| 문서 | 설명 | 핵심 키워드 |
|------|------|------------|
| [게임 진행](./game-process.md) | 턴 구조, 페이즈 순서, 액션 슬롯, 난이도 | Turn, Phase, Action Slot |
| [경제 시스템](./game-economy.md) | 수입/지출 흐름, 재무 건전성, 런웨이 | Revenue, Cost, Runway |
| [프로젝트 시스템](./game-project.md) | 외주/자체서비스 진행, 업무 배분, 기술 부채 | Project, MAU, TechDebt |
| [케미스트리 시스템](./game-chemistry.md) | 팀 케미, 개인 간 케미, 문화 태그 | Chemistry, CultureTag |
| [조직 구조](./game-organization.md) | 회사 성장 단계, 팀 분리, 채용/해고 | Hiring, Firing, TeamSplit |
| [이벤트 시스템](./game-event.md) | 3레이어 이벤트, 연쇄 효과, 외부 이벤트 | Event, ChainReaction |
| [엔딩 시스템](./game-ending.md) | 실패 조건, 멀티 엔딩, 히든 엔딩 | Ending, GameOver |
| [UI/시스템 설계](./game-ui.md) | 대시보드, 저장/로드, 튜토리얼 | Dashboard, Save, Tutorial |

---

## 권장 읽기 순서

1. **[게임 진행](./game-process.md)** — 전체 게임 흐름의 뼈대
2. **[경제 시스템](./game-economy.md)** — 돈의 흐름
3. **[프로젝트 시스템](./game-project.md)** — 돈을 버는 방법
4. **[조직 구조](./game-organization.md)** — 사람 관리
5. **[케미스트리 시스템](./game-chemistry.md)** — 사람 간 관계
6. **[이벤트 시스템](./game-event.md)** — 예측 불가의 요소
7. **[엔딩 시스템](./game-ending.md)** — 게임의 끝
8. **[UI/시스템 설계](./game-ui.md)** — 플레이어에게 보이는 것

---

## 도메인 문서와의 관계

시스템 문서는 **"어떻게 작동하는가"**를, [도메인 문서](../game-domain/README.md)는 **"무엇이 존재하는가"**를 다룹니다.

예시:
- 시스템: "채용 시 이력서 풀에서 3~5장이 생성되고, 명성에 따라 품질이 달라진다" → [조직 구조](./game-organization.md)
- 도메인: "이력서에는 전문 스탯, 기본 스탯, 특성이 표시된다" → [채용/직군](../game-domain/career.md)
