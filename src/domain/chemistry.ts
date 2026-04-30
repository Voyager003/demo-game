import type { OrganizationChemistryState } from '../types/core';
import type { Employee } from '../types/employee';
import type { TraitId } from '../types/trait';
import { hasTrait } from './traits';

const BASE_TEAM_CHEM = 50;

const TRAIT_PAIR_DELTA: Record<string, number> = {
  'Perfectionist:Sprinter': -4,
  'Perfectionist:Cynic': -3,
  'OvertimeMaster:JobHopper': -4,
  'CaringLeader:Cynic': -5,
  'CaringLeader:BurnoutProne': 5,
  'SelfLearner:Perfectionist': 2,
  'SelfLearner:Sprinter': 2,
  'JobHopper:CaringLeader': -3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function traitPairKey(a: TraitId, b: TraitId): string {
  return [a, b].sort().join(':');
}

function computePairDelta(left: Employee, right: Employee): number {
  let delta = 0;
  for (const leftTrait of left.traitProfile.traitIds) {
    for (const rightTrait of right.traitProfile.traitIds) {
      delta += TRAIT_PAIR_DELTA[traitPairKey(leftTrait, rightTrait)] ?? 0;
    }
  }
  return clamp(delta, -12, 12);
}

function buildPairChem(employees: Employee[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (let index = 0; index < employees.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < employees.length; otherIndex += 1) {
      const left = employees[index]!;
      const right = employees[otherIndex]!;
      result[pairKey(left.id, right.id)] = computePairDelta(left, right);
    }
  }
  return result;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function currentTensionHints(employees: Employee[], pairChem: Record<string, number>): string[] {
  const hints: string[] = [];
  for (const [key, value] of Object.entries(pairChem)) {
    if (value > -6) continue;
    const [leftId, rightId] = key.split('::');
    const left = employees.find((employee) => employee.id === leftId);
    const right = employees.find((employee) => employee.id === rightId);
    if (left && right) {
      hints.push(`${left.name}-${right.name} 긴장`);
    }
  }
  return hints.slice(0, 3);
}

function teamChemFromEmployees(employees: Employee[], pairChem: Record<string, number>): number {
  const pairAverage = average(Object.values(pairChem));
  const communicationPenalty = employees.reduce((sum, employee) => sum + Math.min(0, employee.commonStats.communication - 1), 0);
  const mentalPenalty = employees.reduce((sum, employee) => sum + Math.min(0, employee.commonStats.mental - 1), 0);
  const loyaltyPenalty = employees.reduce((sum, employee) => sum + Math.min(0, employee.commonStats.loyalty), 0);
  return clamp(
    Math.round(BASE_TEAM_CHEM + pairAverage * 2 + communicationPenalty * 3 + mentalPenalty * 2 + loyaltyPenalty * 2),
    0,
    100,
  );
}

export class ChemistryBoard {
  private readonly snapshot: OrganizationChemistryState;

  constructor(snapshot?: OrganizationChemistryState) {
    this.snapshot = snapshot ?? {
      teamChem: BASE_TEAM_CHEM,
      pairChem: {},
      recentTensions: [],
      cultureHints: [],
    };
  }

  static initialize(employees: Employee[]): OrganizationChemistryState {
    const pairChem = buildPairChem(employees);
    return {
      teamChem: teamChemFromEmployees(employees, pairChem),
      pairChem,
      recentTensions: currentTensionHints(employees, pairChem),
      cultureHints: [],
    };
  }

  sync(employees: Employee[]): ChemistryBoard {
    return new ChemistryBoard(ChemistryBoard.initialize(employees));
  }

  applyProjectOutcome(employees: Employee[], employeeIds: string[], success: boolean): ChemistryBoard {
    const pairChem = { ...this.snapshot.pairChem };
    for (let index = 0; index < employeeIds.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < employeeIds.length; otherIndex += 1) {
        const key = pairKey(employeeIds[index]!, employeeIds[otherIndex]!);
        pairChem[key] = clamp((pairChem[key] ?? 0) + (success ? 2 : -3), -50, 50);
      }
    }
    return new ChemistryBoard({
      teamChem: teamChemFromEmployees(employees, pairChem),
      pairChem,
      recentTensions: currentTensionHints(employees, pairChem),
      cultureHints: [],
    });
  }

  applySalaryDecision(employees: Employee[], employeeId: string, raised: boolean): ChemistryBoard {
    const pairChem = { ...this.snapshot.pairChem };
    for (const employee of employees) {
      if (employee.id === employeeId) continue;
      const key = pairKey(employeeId, employee.id);
      pairChem[key] = clamp((pairChem[key] ?? 0) + (raised ? 1 : 0), -50, 50);
    }
    return new ChemistryBoard({
      teamChem: teamChemFromEmployees(employees, pairChem),
      pairChem,
      recentTensions: currentTensionHints(employees, pairChem),
      cultureHints: [],
    });
  }

  applyOvertime(employees: Employee[], employeeIds: string[]): ChemistryBoard {
    const pairChem = { ...this.snapshot.pairChem };
    for (let index = 0; index < employeeIds.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < employeeIds.length; otherIndex += 1) {
        const key = pairKey(employeeIds[index]!, employeeIds[otherIndex]!);
        const delta = employeeIds.length > 1 ? 1 : 0;
        pairChem[key] = clamp((pairChem[key] ?? 0) + delta, -50, 50);
      }
    }
    return new ChemistryBoard({
      teamChem: teamChemFromEmployees(employees, pairChem),
      pairChem,
      recentTensions: currentTensionHints(employees, pairChem),
      cultureHints: [],
    });
  }

  applyConflict(): ChemistryBoard {
    return new ChemistryBoard({
      teamChem: clamp(this.snapshot.teamChem - 8, 0, 100),
      pairChem: { ...this.snapshot.pairChem },
      recentTensions: [...this.snapshot.recentTensions, '최근 갈등 발생'].slice(-5),
      cultureHints: [...this.snapshot.cultureHints],
    });
  }

  applyRemoval(employees: Employee[]): ChemistryBoard {
    return this.sync(employees);
  }

  teamChem(): number {
    return this.snapshot.teamChem;
  }

  pairChemOf(a: string, b: string): number {
    return this.snapshot.pairChem[pairKey(a, b)] ?? 0;
  }

  toSnapshot(): OrganizationChemistryState {
    return {
      teamChem: this.snapshot.teamChem,
      pairChem: { ...this.snapshot.pairChem },
      recentTensions: [...this.snapshot.recentTensions],
      cultureHints: [...this.snapshot.cultureHints],
    };
  }
}

export function teamConflictCandidates(employees: Employee[], chemistry: OrganizationChemistryState): Employee[] {
  if (chemistry.teamChem >= 45) return [];
  return employees.filter((employee) =>
    hasTrait(employee, 'Cynic')
    || employee.commonStats.communication <= 0
    || employee.commonStats.mental <= 0,
  );
}
