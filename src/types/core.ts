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

export interface GameState {
  turn: number;
  phase: Phase;
  companyName: string;

  // CEO
  ceo: CEO;

  // 경제
  capital: number; // 단위: 만원

  // 피로도
  currentFatigue: number;
  actionCooldowns: Record<ActionType, number>; // 남은 쿨타임 턴 수

  // 인재
  employees: Employee[];
  pendingResumes: Employee[]; // 채용 공고 후 생성된 이력서

  // 프로젝트
  activeProjects: Project[];
  availableProjects: Project[]; // 계약 가능한 프로젝트 목록
  completedProjectCount: number; // 완료된 프로젝트 수 (B 등급 판정용)
  consecutiveProfitTurns: number; // 연속 흑자 턴 (B 등급 판정용)

  // 팀 케미 (0~100)
  teamChemistry: number;
  pairChemistry: Record<string, Record<string, number>>; // empId → empId → 수치

  // 이벤트
  eventLog: LogEntry[];
  pendingEvents: PendingEvent[];

  // 게임 상태
  gameStatus: GameStatus;
  crisisGraceTurnsLeft: number;
  endingGrade: EndingGrade | null;

  // B 등급용 수익 추적
  outsourcingProfitTurns: number; // 외주 수익 흑자였던 턴 수
}
