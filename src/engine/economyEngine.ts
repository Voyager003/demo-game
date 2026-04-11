import type { Employee } from '../types/employee';
import type { Project } from '../types/project';
import type { GameState } from '../types/core';

// ─── 월 인건비 ───────────────────────────────────────────────
// 연봉 합산 ÷ 12 (4턴마다 공제)
export function calcMonthlySalaries(employees: Employee[]): number {
  return employees.reduce((sum, e) => sum + Math.round(e.salary / 12), 0);
}

// ─── 월 운영비 ───────────────────────────────────────────────
// employeeCount 기준 (단위: 만원/월)
export function calcMonthlyOperatingCosts(employeeCount: number): number {
  const office = employeeCount * 50;
  const fixed = 50; // 인터넷/전기 등
  const cloud = Math.max(20, employeeCount * 5);
  const sw = employeeCount * 10;
  return office + fixed + cloud + sw;
}

// ─── 월 총 지출 ───────────────────────────────────────────────
export function calcMonthlyBurn(employees: Employee[]): number {
  return (
    calcMonthlySalaries(employees) +
    calcMonthlyOperatingCosts(employees.length)
  );
}

// ─── 런웨이 계산 (턴 단위) ───────────────────────────────────
export function calcRunway(capital: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) return Infinity;
  const months = capital / monthlyBurn;
  return Math.floor(months * 4); // 1개월 = 4턴
}

// ─── 잔금 계산 ───────────────────────────────────────────────
export function calcFinalPayment(project: Project): number {
  const base = project.totalAmount * 0.7;
  const satisfactionMultiplier = getSatisfactionMultiplier(
    project.clientSatisfaction,
  );
  return Math.round(base * satisfactionMultiplier);
}

function getSatisfactionMultiplier(satisfaction: number): number {
  if (satisfaction >= 90) return 1.05;
  if (satisfaction >= 70) return 1.0;
  if (satisfaction >= 50) return 0.9;
  if (satisfaction >= 30) return 0.7;
  return 0.5; // 최악의 경우
}

// ─── 4턴 정산 ────────────────────────────────────────────────
// 월 정산: 인건비 + 운영비 차감, 이번 달 완료된 프로젝트 잔금 수령
export function applyMonthlySettlement(
  state: GameState,
  completedThisCycle: Project[],
): { capitalDelta: number; log: string[] } {
  const log: string[] = [];

  const salaries = calcMonthlySalaries(state.employees);
  const operating = calcMonthlyOperatingCosts(state.employees.length);

  let capitalDelta = 0;
  capitalDelta -= salaries;
  log.push(`인건비 차감: -${salaries.toLocaleString()}만원`);

  capitalDelta -= operating;
  log.push(`운영비 차감: -${operating.toLocaleString()}만원`);

  for (const project of completedThisCycle) {
    const payment = calcFinalPayment(project);
    capitalDelta += payment;
    log.push(
      `[${project.name}] 잔금 수령: +${payment.toLocaleString()}만원 (만족도 ${project.clientSatisfaction}%)`,
    );
  }

  return { capitalDelta, log };
}
