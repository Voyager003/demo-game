export type ProjectLevel = 1 | 2;

export type ProjectKind = 'contract' | 'ownedProduct';

export type ProjectStatus = 'available' | 'active' | 'operating' | 'completed' | 'failed';

export type ProjectRevenueModel = 'contract' | 'subscription' | 'commission' | 'ads';

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  level: ProjectLevel;
  totalAmount: number;      // 단위: 만원
  monthlyRevenue: number;   // 단위: 만원, 자체 서비스 반복 수익
  revenueModel: ProjectRevenueModel;
  revenueLabel: string;
  isMainRevenue: boolean;
  advancePaid: boolean;     // 선금(30%) 지급 여부
  finalPaid: boolean;       // 잔금(70%) 지급 여부
  turnsRequired: number;    // 완료까지 필요한 턴 수
  turnsElapsed: number;     // 경과 턴 수
  progress: number;         // 0~100 진척도
  assignedEmployeeIds: string[];
  status: ProjectStatus;
  clientSatisfaction: number; // 0~100 (납품 시 계산)
  overtimeActive: boolean;    // 야근 지시 여부 (해당 턴만)
}
