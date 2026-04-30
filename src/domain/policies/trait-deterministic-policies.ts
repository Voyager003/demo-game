import type { Employee } from '../../types/employee';
import type { LayerEffect } from '../../types/layer';
import type { Project } from '../../types/project';
import { hasTrait } from '../traits';

const PROGRESS_METRIC = 'project.progressPerTurn' as const;
const SATISFACTION_METRIC = 'project.clientSatisfaction' as const;
const RECURRING_REVENUE_METRIC = 'economy.recurringRevenue' as const;

export class TraitDeterministicPolicy {
  projectEffects(project: Project, assignedEmployees: Employee[]): LayerEffect[] {
    const effects: LayerEffect[] = [];
    const progressRatio = project.turnsRequired > 0 ? project.turnsElapsed / project.turnsRequired : 0;

    for (const employee of assignedEmployees) {
      if (hasTrait(employee, 'Sprinter')) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: progressRatio < 0.5 ? 0.12 : -0.12,
          reason: `${employee.name} 스프린터`,
          sourceRuleId: 'trait.progress.sprinter',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'Perfectionist')) {
        effects.push({
          layer: 'deterministic',
          metric: SATISFACTION_METRIC,
          operation: 'add',
          value: 6,
          reason: `${employee.name} 완벽주의자`,
          sourceRuleId: 'trait.satisfaction.perfectionist',
          targetId: employee.id,
          sourceName: employee.name,
        });
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: -0.08,
          reason: `${employee.name} 완벽주의자`,
          sourceRuleId: 'trait.progress.perfectionist',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'OvertimeMaster') && project.overtimeActive) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: 0.1,
          reason: `${employee.name} 야근장인`,
          sourceRuleId: 'trait.progress.overtime-master',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'CaringLeader')) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: -0.04,
          reason: `${employee.name} 배려형리더`,
          sourceRuleId: 'trait.progress.caring-leader',
          targetId: employee.id,
          sourceName: employee.name,
        });
        effects.push({
          layer: 'deterministic',
          metric: SATISFACTION_METRIC,
          operation: 'add',
          value: 2,
          reason: `${employee.name} 배려형리더`,
          sourceRuleId: 'trait.satisfaction.caring-leader',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'Cynic')) {
        effects.push({
          layer: 'deterministic',
          metric: SATISFACTION_METRIC,
          operation: 'add',
          value: -3,
          reason: `${employee.name} 냉소주의자`,
          sourceRuleId: 'trait.satisfaction.cynic',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'SelfLearner')) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: 0.04,
          reason: `${employee.name} 독학왕`,
          sourceRuleId: 'trait.progress.self-learner',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'JobHopper')) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: -0.03,
          reason: `${employee.name} 이직욕구자`,
          sourceRuleId: 'trait.progress.job-hopper',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
      if (hasTrait(employee, 'BurnoutProne') && employee.hp <= 50) {
        effects.push({
          layer: 'deterministic',
          metric: PROGRESS_METRIC,
          operation: 'percent',
          value: -0.06,
          reason: `${employee.name} 번아웃취약자`,
          sourceRuleId: 'trait.progress.burnout-prone',
          targetId: employee.id,
          sourceName: employee.name,
        });
      }
    }

    return effects;
  }

  recurringRevenueEffects(project: Project, assignedEmployees: Employee[], teamChem: number): LayerEffect[] {
    const effects: LayerEffect[] = [];
    for (const employee of assignedEmployees) {
      if (hasTrait(employee, 'Perfectionist')) {
        effects.push({
          layer: 'deterministic',
          metric: RECURRING_REVENUE_METRIC,
          operation: 'percent',
          value: 0.04,
          reason: `${employee.name} 완벽주의자`,
          sourceRuleId: 'trait.revenue.perfectionist',
          targetId: project.id,
          sourceName: project.name,
        });
      }
      if (hasTrait(employee, 'CaringLeader')) {
        effects.push({
          layer: 'deterministic',
          metric: RECURRING_REVENUE_METRIC,
          operation: 'percent',
          value: 0.02,
          reason: `${employee.name} 배려형리더`,
          sourceRuleId: 'trait.revenue.caring-leader',
          targetId: project.id,
          sourceName: project.name,
        });
      }
      if (hasTrait(employee, 'Cynic')) {
        effects.push({
          layer: 'deterministic',
          metric: RECURRING_REVENUE_METRIC,
          operation: 'percent',
          value: -0.03,
          reason: `${employee.name} 냉소주의자`,
          sourceRuleId: 'trait.revenue.cynic',
          targetId: project.id,
          sourceName: project.name,
        });
      }
      if (hasTrait(employee, 'SelfLearner')) {
        effects.push({
          layer: 'deterministic',
          metric: RECURRING_REVENUE_METRIC,
          operation: 'percent',
          value: 0.03,
          reason: `${employee.name} 독학왕`,
          sourceRuleId: 'trait.revenue.self-learner',
          targetId: project.id,
          sourceName: project.name,
        });
      }
    }

    if (teamChem >= 70) {
      effects.push({
        layer: 'deterministic',
        metric: RECURRING_REVENUE_METRIC,
        operation: 'percent',
        value: 0.04,
        reason: `높은 팀 케미 ${teamChem}`,
        sourceRuleId: 'trait.revenue.team-chem-high',
        targetId: project.id,
        sourceName: project.name,
      });
    } else if (teamChem < 50) {
      effects.push({
        layer: 'deterministic',
        metric: RECURRING_REVENUE_METRIC,
        operation: 'percent',
        value: -0.05,
        reason: `낮은 팀 케미 ${teamChem}`,
        sourceRuleId: 'trait.revenue.team-chem-low',
        targetId: project.id,
        sourceName: project.name,
      });
    }

    return effects;
  }
}

export const defaultTraitDeterministicPolicy = new TraitDeterministicPolicy();
