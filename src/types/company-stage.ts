export type CompanyStage = 'solo' | 'earlyTeam' | 'startup' | 'scaleUp';

export interface CompanyStageRequirementSnapshot {
  label: string;
  key: 'employees' | 'capital' | 'companyRating' | 'recurringRevenue';
  current: number;
  required: number;
  met: boolean;
  unit?: string;
}

export interface CompanyStagePreview {
  stage: CompanyStage | null;
  stageLabel: string | null;
  requirements: CompanyStageRequirementSnapshot[];
}

export interface CompanyStageState {
  currentStage: CompanyStage;
  highestStage: CompanyStage;
  lastPromotedTurn: number | null;
  nextStagePreview: CompanyStagePreview;
}
