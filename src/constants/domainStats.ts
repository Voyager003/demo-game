import type { Domain } from '../types/ceo';
import type { CeoStats } from '../types/ceo';

export const DOMAIN_INITIAL_STATS: Record<Domain, CeoStats> = {
  b2bsaas: {
    leadership: 3,
    negotiation: 4,
    vision: 3,
    techUnderstanding: 5,
    crisisResponse: 2,
  },
  commerce: {
    leadership: 3,
    negotiation: 5,
    vision: 3,
    techUnderstanding: 3,
    crisisResponse: 3,
  },
  community: {
    leadership: 4,
    negotiation: 3,
    vision: 5,
    techUnderstanding: 2,
    crisisResponse: 3,
  },
  fintech: {
    leadership: 2,
    negotiation: 4,
    vision: 3,
    techUnderstanding: 5,
    crisisResponse: 3,
  },
  healthcareit: {
    leadership: 3,
    negotiation: 3,
    vision: 4,
    techUnderstanding: 4,
    crisisResponse: 3,
  },
};

export const DOMAIN_LABELS: Record<Domain, string> = {
  b2bsaas: 'B2B SaaS',
  commerce: '커머스',
  community: '커뮤니티/미디어',
  fintech: '핀테크',
  healthcareit: '헬스케어IT',
};

export const DOMAIN_DESCRIPTIONS: Record<Domain, string> = {
  b2bsaas: '기술 이해도가 높은 창업자. 개발팀 없이도 기본 생산성 확보 가능.',
  commerce: '협상력이 강점. 외주 계약과 연봉 협상에서 유리한 조건 확보.',
  community: '비전이 뛰어난 리더. 핵심 인재 유지와 팀 결속에 강점.',
  fintech: '기술+협상 특화. 리더십이 낮아 초반 행동 수가 적음.',
  healthcareit: '고른 스탯의 균형형 CEO. 특화된 강점은 없지만 약점도 없음.',
};
