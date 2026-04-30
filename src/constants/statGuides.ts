import type {
  CommonStats,
  DesignerStats,
  DeveloperStats,
  PmStats,
  Role,
} from '../types/employee';

export interface StatGuide {
  label: string;
  range: string;
  description: string;
  deterministicImpact: string[];
}

export const COMMON_STAT_GUIDES: Record<keyof CommonStats, StatGuide> = {
  stamina: {
    label: '체력',
    range: '-1~5',
    description: '지속적으로 버티는 힘입니다.',
    deterministicImpact: [
      '외주 진행 보정에 반영됩니다.',
      '주수입원 운영 안정성 보정에 반영됩니다.',
    ],
  },
  communication: {
    label: '소통',
    range: '-1~5',
    description: '협업과 정보 전달의 정확도입니다.',
    deterministicImpact: [
      '외주 진행 보정에 반영됩니다.',
      '주수입원 실효 수입 보정에 강하게 반영됩니다.',
    ],
  },
  mental: {
    label: '멘탈',
    range: '-1~5',
    description: '압박 속에서 흔들리지 않는 안정성입니다.',
    deterministicImpact: [
      '외주 진행 보정에 반영됩니다.',
      '주수입원 운영 안정성 보정에 반영됩니다.',
    ],
  },
  growthRate: {
    label: '성장속도',
    range: '-1~5',
    description: '새 업무에 적응하고 성과를 끌어올리는 속도입니다.',
    deterministicImpact: [
      '외주 진행 보정에 소폭 반영됩니다.',
      '주수입원 개선 속도 보정에 반영됩니다.',
    ],
  },
  loyalty: {
    label: '충성도',
    range: '-1~5',
    description: '책임감 있게 끝까지 밀어붙이는 성향입니다.',
    deterministicImpact: [
      '외주 진행 보정에 소폭 반영됩니다.',
      '주수입원 운영 집중도 보정에 반영됩니다.',
    ],
  },
};

export const SPECIALIST_STAT_GUIDES: Record<
Role,
Record<keyof DeveloperStats | keyof DesignerStats | keyof PmStats, StatGuide>
> = {
  developer: {
    codingSpeed: {
      label: '구현속도',
      range: '1~10',
      description: '개발 작업을 빠르게 밀어내는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴에 직접 반영됩니다.',
        '주수입원 기능 처리율 보정에 반영됩니다.',
      ],
    },
    codeQuality: {
      label: '코드품질',
      range: '1~10',
      description: '안정적이고 유지보수하기 좋은 코드를 만드는 능력입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 직접 반영됩니다.',
        '주수입원 품질 기반 수입 보정에 반영됩니다.',
      ],
    },
    problemSolving: {
      label: '문제해결력',
      range: '1~10',
      description: '막힌 일을 풀어내고 병목을 제거하는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴에 직접 반영됩니다.',
        '주수입원 운영 효율 보정에 반영됩니다.',
      ],
    },
    techBreadth: {
      label: '기술폭',
      range: '1~10',
      description: '여러 기술과 요구사항을 빠르게 소화하는 폭입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴에 반영됩니다.',
        '주수입원 확장 대응력 보정에 반영됩니다.',
      ],
    },
    securitySense: {
      label: '보안감각',
      range: '1~10',
      description: '문제를 미리 막고 위험을 줄이는 감각입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 반영됩니다.',
        '주수입원 안정성 기반 수입 보정에 반영됩니다.',
      ],
    },
    uiSense: {
      label: 'UI감각',
      range: '1~10',
      description: '시각적 완성도를 끌어올리는 능력입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 직접 반영됩니다.',
        '주수입원 인상과 전환력 보정에 반영됩니다.',
      ],
    },
    uxThinking: {
      label: 'UX사고력',
      range: '1~10',
      description: '사용자 흐름을 매끄럽게 설계하는 능력입니다.',
      deterministicImpact: [
        '외주 완료 턴과 만족도에 모두 반영됩니다.',
        '주수입원 사용성 기반 수입 보정에 반영됩니다.',
      ],
    },
    workSpeed: {
      label: '작업속도',
      range: '1~10',
      description: '디자인 산출물을 빠르게 내는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴에 직접 반영됩니다.',
        '주수입원 제작 속도 보정에 반영됩니다.',
      ],
    },
    brandingSense: {
      label: '브랜딩감각',
      range: '1~10',
      description: '제품 인상을 일관되게 만드는 능력입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 반영됩니다.',
        '주수입원 브랜드 기반 수입 보정에 반영됩니다.',
      ],
    },
    prototyping: {
      label: '프로토타이핑',
      range: '1~10',
      description: '아이디어를 빠르게 형태로 만드는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴에 반영됩니다.',
        '주수입원 개선 속도 보정에 반영됩니다.',
      ],
    },
    scheduleManagement: {
      label: '일정관리',
      range: '1~10',
      description: '마감과 진행 속도를 통제하는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴 보정에 직접 반영됩니다.',
        '주수입원 운영 리듬 보정에 반영됩니다.',
      ],
    },
    requirementAnalysis: {
      label: '요구사항분석',
      range: '1~10',
      description: '해야 할 일을 정확히 해석하는 능력입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 직접 반영됩니다.',
        '주수입원 개선 방향 보정에 반영됩니다.',
      ],
    },
    riskDetection: {
      label: '리스크감지',
      range: '1~10',
      description: '문제가 커지기 전에 짚어내는 능력입니다.',
      deterministicImpact: [
        '외주 완료 턴과 만족도에 모두 반영됩니다.',
        '주수입원 안정성 보정에 반영됩니다.',
      ],
    },
    clientManagement: {
      label: '고객응대',
      range: '1~10',
      description: '상대 기대치를 맞추고 관계를 관리하는 능력입니다.',
      deterministicImpact: [
        '외주 납품 만족도에 직접 반영됩니다.',
        '주수입원 고객 경험 기반 수입 보정에 반영됩니다.',
      ],
    },
    teamCoordination: {
      label: '팀조율력',
      range: '1~10',
      description: '사람과 업무를 엮어 흐름을 매끄럽게 만드는 능력입니다.',
      deterministicImpact: [
        '외주 프로젝트 완료 턴과 만족도에 모두 반영됩니다.',
        '주수입원 운영 효율 보정에 반영됩니다.',
      ],
    },
  },
  designer: {} as Record<keyof DeveloperStats | keyof DesignerStats | keyof PmStats, StatGuide>,
  pm: {} as Record<keyof DeveloperStats | keyof DesignerStats | keyof PmStats, StatGuide>,
};

SPECIALIST_STAT_GUIDES.designer = SPECIALIST_STAT_GUIDES.developer;
SPECIALIST_STAT_GUIDES.pm = SPECIALIST_STAT_GUIDES.developer;

export function getCommonStatGuide(key: keyof CommonStats): StatGuide {
  return COMMON_STAT_GUIDES[key];
}

export function getSpecialistStatGuide(role: Role, key: string): StatGuide | undefined {
  return SPECIALIST_STAT_GUIDES[role][key as keyof typeof SPECIALIST_STAT_GUIDES[typeof role]];
}
