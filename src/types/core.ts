import type { CEO } from './ceo';
import type { Employee } from './employee';
import type { Project } from './project';
import type { LogEntry, PendingEvent } from './event';

export type Phase = 1 | 2 | 3 | 4 | 5;

export type GameStatus = 'setup' | 'playing' | 'crisis' | 'ended';

export type EndingGrade = 'B' | 'C' | 'F';

export type ActionType =
  | 'postJobListing'
  | 'conductInterview'
  | 'fireEmployee'
  | 'adjustSalary'
  | 'signContract'
  | 'changeAssignment'
  | 'orderOvertime';

export interface FatigueState {
  current: number;
  max: number;
  cooldowns: Record<ActionType, number>;
}

export interface GameState {
  turn: number;
  phase: Phase;
  companyName: string;

  // CEO
  ceo: CEO;

  // 경제
  capital: number; // 단위: 만원

  // 피로도
  fatigue: FatigueState;

  // 인재
  employees: Employee[];
  pendingResumes: Employee[]; // 채용 공고 후 생성된 이력서

  // 프로젝트
  activeProjects: Project[];
  availableProjects: Project[]; // 계약 가능한 프로젝트 목록
  completedProjectCount: number;

  // 이벤트
  eventLog: LogEntry[];
  pendingEvents: PendingEvent[];

  // 게임 상태
  gameStatus: GameStatus;
  crisisGraceTurnsLeft: number;
  endingGrade: EndingGrade | null;
}
