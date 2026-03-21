# 게임 도메인 (Game Domain)

게임에 **무엇이 존재하는지** — 엔티티, 개념, 용어를 정의하는 문서입니다.

---

## 문서 목록

| 문서 | 설명 | 핵심 엔티티 |
|------|------|------------|
| [회사](./company.md) | 회사 프로필, 카테고리, 성장 단계 | Company, Category, Stage |
| [대표(CEO)](./player.md) | 대표 스탯 정의 및 성장 방식 | CEO, Stat |
| [채용/직군](./career.md) | 고용 형태, 직군별 스탯, 이력서 | Employee, JobRole, Resume |
| [특성](./trait.md) | 업무/사회성/성장/리스크 특성, 충돌/시너지 | Trait, Synergy, Conflict |
| [투자](./invest.md) | 투자 라운드, 심사 요소, 투자사 | Investment, Series, Investor |
| [수입원](./revenue.md) | 외주 계약, 서비스, 추가 수입원 | Contract, Service, Revenue |
| [지출](./cost.md) | 연봉, 운영비, 복지, 마케팅 채널 | Salary, Welfare, Marketing |
| [이벤트 카탈로그](./event-catalog.md) | 시장 트렌드, 법규제, 랜덤 이벤트 | Event, Trend, Regulation |
| [기술](./tech.md) | 기술 부채 레벨, 리팩토링 | TechDebt, Refactoring |

---

## 권장 읽기 순서

1. **[회사](./company.md)** — 게임의 주체
2. **[대표(CEO)](./player.md)** — 플레이어 캐릭터
3. **[채용/직군](./career.md)** — 함께 일할 사람들
4. **[특성](./trait.md)** — 사람들의 개성
5. **[투자](./invest.md)** — 자금 조달
6. **[수입원](./revenue.md)** — 돈을 버는 곳
7. **[지출](./cost.md)** — 돈이 나가는 곳
8. **[이벤트 카탈로그](./event-catalog.md)** — 발생하는 사건들
9. **[기술](./tech.md)** — 기술적 요소

---

## 시스템 문서와의 관계

도메인 문서는 **"무엇이 존재하는가"**를, [시스템 문서](../game-system/README.md)는 **"어떻게 작동하는가"**를 다룹니다.

예시:
- 도메인: "개발자의 전문 스탯은 구현속도, 코드품질, 문제해결력, 기술스택폭, 보안감각이다" → [채용/직군](./career.md)
- 시스템: "전문 스탯 합산에 따라 프로젝트 난이도 티어가 결정된다" → [프로젝트 시스템](../game-system/game-project.md)
