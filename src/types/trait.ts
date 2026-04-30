export type TraitCategory = 'workStyle' | 'social' | 'growth' | 'risk';

export type TraitId =
  | 'Sprinter'
  | 'Perfectionist'
  | 'OvertimeMaster'
  | 'CaringLeader'
  | 'Cynic'
  | 'SelfLearner'
  | 'JobHopper'
  | 'BurnoutProne';

export type TraitRevealTriggerType =
  | 'resume'
  | 'projectCompleted'
  | 'overtime'
  | 'lowHp'
  | 'salaryNegotiation'
  | 'lowLoyalty'
  | 'teamConflict'
  | 'supportEvent';

export interface TraitHint {
  category: TraitCategory;
  text: string;
}

export interface TraitUnlockRecord {
  traitId: TraitId;
  trigger: TraitRevealTriggerType;
  turn: number;
  note: string;
}

export interface TraitRevealState {
  revealedTraitIds: TraitId[];
  hints: TraitHint[];
  unlockHistory: TraitUnlockRecord[];
}

export interface TraitProfile {
  traitIds: TraitId[];
  reveal: TraitRevealState;
}
