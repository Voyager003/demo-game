import type { GameState } from '../types/core';
import type { PendingEvent } from '../types/event';

function generateId(): string {
  return 'evt_' + Math.random().toString(36).slice(2, 9);
}

// ─── 결정론적 이벤트 생성 ─────────────────────────────────────
// Phase1(이벤트 Phase)에서 호출: 이번 턴 발생할 이벤트 목록 반환
export function generatePendingEvents(state: GameState): PendingEvent[] {
  const events: PendingEvent[] = [];

  // 1. 수습 전환 이벤트 (probationTurnsLeft === 0)
  for (const emp of state.employees) {
    if (emp.probationTurnsLeft === 0 && emp.employmentType === 'regular') {
      events.push({
        id: generateId(),
        type: 'probationConversion',
        layer: 'deterministic',
        title: `${emp.name} 수습 전환`,
        description: `${emp.name}(${emp.role})의 수습 기간이 종료되었습니다. 정규직으로 전환하시겠습니까?`,
        choices: [
          { label: '정규직 전환', effect: '직원 유지, 충성도 +2' },
          { label: '계약 종료', effect: '직원 퇴사, 명성 -5' },
        ],
        targetId: emp.id,
      });
    }
  }

  // 2. 연봉 협상 요청 (충성도 낮고 12턴 재직)
  for (const emp of state.employees) {
    const tenureElapsed = state.turn - emp.hiredOnTurn;
    if (
      emp.commonStats.loyalty <= 1 &&
      tenureElapsed > 0 &&
      tenureElapsed % 12 === 0 &&
      emp.probationTurnsLeft === 0
    ) {
      events.push({
        id: generateId(),
        type: 'salaryNegotiation',
        layer: 'deterministic',
        title: `${emp.name} 연봉 협상 요청`,
        description: `${emp.name}이(가) 연봉 인상을 요청합니다. 현재 연봉: ${emp.salary.toLocaleString()}만원`,
        choices: [
          { label: '10% 인상 수락', effect: '충성도 +2, 연봉 +10%' },
          { label: '5% 인상 수락', effect: '충성도 +1, 연봉 +5%' },
          { label: '거절', effect: '충성도 -2' },
        ],
        targetId: emp.id,
      });
    }
  }

  // 3. 납기 임박 알림 (잔여 3턴 이하)
  for (const proj of state.activeProjects) {
    const turnsRemaining = proj.turnsRequired - proj.turnsElapsed;
    if (turnsRemaining === 3) {
      events.push({
        id: generateId(),
        type: 'deadlineApproaching',
        layer: 'deterministic',
        title: `납기 임박: ${proj.name}`,
        description: `[${proj.name}] 납기까지 ${turnsRemaining}턴 남았습니다. 현재 진척도: ${Math.round(proj.progress)}%`,
        choices: [{ label: '확인', effect: '알림 확인' }],
        targetId: proj.id,
      });
    }
  }

  // 4. 자본 위기 경고
  if (state.capital <= 500 && state.capital > 0) {
    events.push({
      id: generateId(),
      type: 'capitalCrisis',
      layer: 'deterministic',
      title: '자본 위기 경고',
      description: `잔여 자본이 ${state.capital.toLocaleString()}만원입니다. 런웨이를 확인하세요.`,
      choices: [{ label: '확인', effect: '알림 확인' }],
    });
  }

  return events;
}
