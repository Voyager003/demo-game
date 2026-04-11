import type { Trait } from './trait';

export type Role = 'developer' | 'designer' | 'pm';

export type EmploymentType = 'regular' | 'contract';

export interface DeveloperStats {
  codingSpeed: number;     // 1~10
  codeQuality: number;     // 1~10
  problemSolving: number;  // 1~10
  techBreadth: number;     // 1~10
  securitySense: number;   // 1~10
}

export interface DesignerStats {
  uiSense: number;         // 1~10
  uxThinking: number;      // 1~10
  workSpeed: number;       // 1~10
  brandingSense: number;   // 1~10
  prototyping: number;     // 1~10
}

export interface PmStats {
  scheduleManagement: number;  // 1~10
  requirementAnalysis: number; // 1~10
  riskDetection: number;       // 1~10
  clientManagement: number;    // 1~10
  teamCoordination: number;    // 1~10
}

export type SpecialistStats = DeveloperStats | DesignerStats | PmStats;

export interface CommonStats {
  stamina: number;       // -1~5
  communication: number; // -1~5
  mental: number;        // -1~5
  growthRate: number;    // -1~5
  loyalty: number;       // -1~5
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  employmentType: EmploymentType;
  probationTurnsLeft: number; // 12에서 카운트다운, 0이면 전환 대기, -1이면 수습 없음(창업 멤버·전환 완료)
  specialistStats: SpecialistStats;
  commonStats: CommonStats;
  traits: Trait[]; // 정확히 3개
  salary: number;  // 연봉 단위: 만원 (예: 4800 = 4800만원)
  hp: number;      // 0~100
  projectAssignments: Record<string, number>; // projectId → 배정 비율 (%)
  hiredOnTurn: number;
}
