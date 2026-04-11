export type ProjectLevel = 1 | 2;

export type ProjectStatus = 'available' | 'active' | 'completed' | 'failed';

export interface Project {
  id: string;
  name: string;
  level: ProjectLevel;
  totalAmount: number;      // 단위: 만원
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
