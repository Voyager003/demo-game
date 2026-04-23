import { defaultEmployeeFactory, EmployeeFactory } from './factories/employee-factory';
import { defaultProjectFactory, ProjectFactory } from './factories/project-factory';
import type { RandomSource } from './generation';
import { MathRandomSource } from './generation';
import {
  InvestmentResultResolver,
  InvestmentReviewPolicy,
} from './policies/investment-policies';
import {
  CrisisPolicy,
  MonthlySettlementPolicy,
  PendingEventFactory,
  ProbationEventResolver,
  SalaryNegotiationResolver,
} from './policies/session-policies';

export interface GameSessionDependencies {
  random: RandomSource;
  employeeFactory: EmployeeFactory;
  projectFactory: ProjectFactory;
  pendingEventFactory: PendingEventFactory;
  crisisPolicy: CrisisPolicy;
  monthlySettlementPolicy: MonthlySettlementPolicy;
  probationEventResolver: ProbationEventResolver;
  salaryNegotiationResolver: SalaryNegotiationResolver;
  investmentReviewPolicy: InvestmentReviewPolicy;
  investmentResultResolver: InvestmentResultResolver;
}

export function createGameSessionDependencies(
  overrides: Partial<GameSessionDependencies> = {},
): GameSessionDependencies {
  const random = overrides.random ?? new MathRandomSource();
  return {
    random,
    employeeFactory: overrides.employeeFactory ?? defaultEmployeeFactory,
    projectFactory: overrides.projectFactory ?? defaultProjectFactory,
    pendingEventFactory: overrides.pendingEventFactory ?? new PendingEventFactory(),
    crisisPolicy: overrides.crisisPolicy ?? new CrisisPolicy(),
    monthlySettlementPolicy: overrides.monthlySettlementPolicy ?? new MonthlySettlementPolicy(),
    probationEventResolver: overrides.probationEventResolver ?? new ProbationEventResolver(),
    salaryNegotiationResolver: overrides.salaryNegotiationResolver ?? new SalaryNegotiationResolver(),
    investmentReviewPolicy: overrides.investmentReviewPolicy ?? new InvestmentReviewPolicy(random),
    investmentResultResolver: overrides.investmentResultResolver ?? new InvestmentResultResolver(),
  };
}
