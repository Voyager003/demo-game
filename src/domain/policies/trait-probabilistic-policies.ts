import { probabilisticLayer } from '../layers/probabilistic-layer';
import type { RandomSource } from '../generation';
import type { LayerEffect } from '../../types/layer';
import type { GameState } from '../../types/core';
import type { Employee } from '../../types/employee';
import type { PendingEvent } from '../../types/event';
import type { IdGenerator } from '../generation';
import { TimestampIdGenerator } from '../generation';
import { hasTrait } from '../traits';

export interface ProbabilisticEventOutcome {
  pendingEvents: PendingEvent[];
  employees: Employee[];
  logs: Array<{
    message: string;
    source: string;
    layer: 'probabilistic';
    layerTrace: NonNullable<ReturnType<typeof probabilisticLayer.resolve>['probability']>['trace'];
  }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function probabilityEffect(metric: 'probability.employeeBurnout' | 'probability.employeeQuit' | 'probability.teamConflict', value: number, reason: string, sourceRuleId: string, targetId?: string, sourceName?: string): LayerEffect {
  return {
    layer: 'probabilistic',
    metric,
    operation: 'percent',
    value,
    reason,
    sourceRuleId,
    targetId,
    sourceName,
  };
}

export class TraitProbabilisticEventPolicy {
  private readonly random: RandomSource;
  private readonly ids: IdGenerator;

  constructor(random: RandomSource, ids: IdGenerator = new TimestampIdGenerator(random)) {
    this.random = random;
    this.ids = ids;
  }

  evaluate(state: Pick<GameState, 'turn' | 'employees' | 'organization' | 'pendingEvents'>): ProbabilisticEventOutcome {
    const employees = [...state.employees];
    const pendingEvents: PendingEvent[] = [];
    const logs: ProbabilisticEventOutcome['logs'] = [];
    const existingKeys = new Set(state.pendingEvents.map((event) => `${event.type}:${event.targetId ?? 'global'}`));

    for (const employee of employees) {
      if (employee.hp <= 30) {
        const burnout = this.resolveBurnout(employee, state.organization.chemistry.teamChem);
        if (burnout && !existingKeys.has(`employeeBurnout:${employee.id}`)) {
          pendingEvents.push({
            id: this.ids.next('evt_'),
            type: 'employeeBurnout',
            layer: 'probabilistic',
            title: `${employee.name} 번아웃 위기`,
            description: `${employee.name}이(가) 과부하 상태에 들어갔습니다.`,
            choices: [{ label: '확인', effect: '이번 턴 휴식 및 충성도 하락' }],
            targetId: employee.id,
          });
          logs.push(burnout);
        }
      }

      if (employee.commonStats.loyalty <= 0) {
        const quit = this.resolveQuit(employee, state.organization.chemistry.teamChem);
        if (quit && !existingKeys.has(`employeeQuit:${employee.id}`)) {
          pendingEvents.push({
            id: this.ids.next('evt_'),
            type: 'employeeQuit',
            layer: 'probabilistic',
            title: `${employee.name} 이직 통보`,
            description: `${employee.name}이(가) 회사를 떠날 가능성이 높아졌습니다.`,
            choices: [{ label: '확인', effect: '직원 퇴사 처리' }],
            targetId: employee.id,
          });
          logs.push(quit);
        }
      }
    }

    if (state.organization.chemistry.teamChem < 45 && !existingKeys.has('teamConflict:global')) {
      const conflict = this.resolveConflict(state.employees, state.organization.chemistry.teamChem);
      if (conflict) {
        pendingEvents.push({
          id: this.ids.next('evt_'),
          type: 'teamConflict',
          layer: 'probabilistic',
          title: '팀 갈등 발생',
          description: '팀 내부 갈등이 수면 위로 올라왔습니다.',
          choices: [{ label: '확인', effect: '팀 케미 저하 및 관련 특성 공개 가능' }],
        });
        logs.push(conflict);
      }
    }

    return { pendingEvents, employees, logs };
  }

  private resolveBurnout(employee: Employee, teamChem: number): ProbabilisticEventOutcome['logs'][number] | null {
    const effects: LayerEffect[] = [];
    if (hasTrait(employee, 'BurnoutProne')) {
      effects.push(probabilityEffect('probability.employeeBurnout', 0.22, `${employee.name} 번아웃취약자`, 'trait.burnout-prone', employee.id, employee.name));
    }
    if (employee.hp <= 15) {
      effects.push(probabilityEffect('probability.employeeBurnout', 0.18, `${employee.name} HP 임계치`, 'trait.burnout.hp', employee.id, employee.name));
    }
    if (teamChem < 40) {
      effects.push(probabilityEffect('probability.employeeBurnout', 0.08, '낮은 팀 케미', 'trait.burnout.team-chem', employee.id, employee.name));
    }
    const resolution = probabilisticLayer.resolve({
      metric: 'probability.employeeBurnout',
      baseProbability: 0.03,
      effects,
      trace: {
        rule: '직원 번아웃 확률 판정',
        trigger: '저HP 상태 직원 평가',
        inputs: [`employee=${employee.name}`, `hp=${employee.hp}`, `teamChem=${teamChem}`],
      },
    });
    if (!resolution.probability || this.random.next() >= resolution.probability.finalValue) return null;
    return {
      message: `${employee.name} 번아웃 확률 이벤트가 발동했습니다.`,
      source: 'TraitProbabilisticEventPolicy.evaluate',
      layer: 'probabilistic',
      layerTrace: resolution.probability.trace,
    };
  }

  private resolveQuit(employee: Employee, teamChem: number): ProbabilisticEventOutcome['logs'][number] | null {
    const effects: LayerEffect[] = [];
    if (hasTrait(employee, 'JobHopper')) {
      effects.push(probabilityEffect('probability.employeeQuit', 0.2, `${employee.name} 이직욕구자`, 'trait.job-hopper', employee.id, employee.name));
    }
    effects.push(probabilityEffect('probability.employeeQuit', clamp((1 - employee.commonStats.loyalty) * 0.05, 0, 0.15), `${employee.name} 낮은 충성도`, 'trait.quit.loyalty', employee.id, employee.name));
    if (teamChem < 45) {
      effects.push(probabilityEffect('probability.employeeQuit', 0.07, '낮은 팀 케미', 'trait.quit.team-chem', employee.id, employee.name));
    }
    const resolution = probabilisticLayer.resolve({
      metric: 'probability.employeeQuit',
      baseProbability: 0.02,
      effects,
      trace: {
        rule: '직원 이직 확률 판정',
        trigger: '낮은 loyalty 상태 직원 평가',
        inputs: [`employee=${employee.name}`, `loyalty=${employee.commonStats.loyalty}`, `teamChem=${teamChem}`],
      },
    });
    if (!resolution.probability || this.random.next() >= resolution.probability.finalValue) return null;
    return {
      message: `${employee.name} 이직 확률 이벤트가 발동했습니다.`,
      source: 'TraitProbabilisticEventPolicy.evaluate',
      layer: 'probabilistic',
      layerTrace: resolution.probability.trace,
    };
  }

  private resolveConflict(employees: Employee[], teamChem: number): ProbabilisticEventOutcome['logs'][number] | null {
    const cynical = employees.filter((employee) => hasTrait(employee, 'Cynic')).length;
    const effects: LayerEffect[] = [];
    if (cynical > 0) {
      effects.push(probabilityEffect('probability.teamConflict', cynical * 0.08, `냉소주의자 ${cynical}명`, 'trait.team-conflict.cynic'));
    }
    effects.push(probabilityEffect('probability.teamConflict', clamp((50 - teamChem) * 0.005, 0, 0.2), `낮은 팀 케미 ${teamChem}`, 'trait.team-conflict.team-chem'));
    const resolution = probabilisticLayer.resolve({
      metric: 'probability.teamConflict',
      baseProbability: 0.04,
      effects,
      trace: {
        rule: '팀 갈등 확률 판정',
        trigger: '낮은 teamChem 상태에서 갈등 가능성 평가',
        inputs: [`teamChem=${teamChem}`, `cynicCount=${cynical}`],
      },
    });
    if (!resolution.probability || this.random.next() >= resolution.probability.finalValue) return null;
    return {
      message: '팀 갈등 확률 이벤트가 발동했습니다.',
      source: 'TraitProbabilisticEventPolicy.evaluate',
      layer: 'probabilistic',
      layerTrace: resolution.probability.trace,
    };
  }
}
