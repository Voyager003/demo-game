import { EmployeeFactory } from './factories/employee-factory';
import { ProjectFactory } from './factories/project-factory';
import type { RandomSource } from './generation';
import { MathRandomSource } from './generation';
import { TraitRevealPolicy } from './traits';
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
import { TraitProbabilisticEventPolicy } from './policies/trait-probabilistic-policies';
import {
  CompanyStageInvestmentGatePolicy,
  CompanyStagePressurePolicy,
  CompanyStageProgressionPolicy,
  defaultCompanyStageInvestmentGatePolicy,
  defaultCompanyStagePressurePolicy,
  defaultCompanyStageProgressionPolicy,
} from './policies/company-stage-policies';
import {
  ContractOfferLifecyclePolicy,
  ContractOfferSpawnPolicy,
  DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY,
  DEFAULT_CONTRACT_OFFER_SPAWN_POLICY,
} from './policies/project-policies';

export interface GameSessionDependencies {
  random: RandomSource;
  employeeFactory: EmployeeFactory;
  projectFactory: ProjectFactory;
  pendingEventFactory: PendingEventFactory;
  crisisPolicy: CrisisPolicy;
  companyStageProgressionPolicy: CompanyStageProgressionPolicy;
  companyStagePressurePolicy: CompanyStagePressurePolicy;
  companyStageInvestmentGatePolicy: CompanyStageInvestmentGatePolicy;
  contractOfferLifecyclePolicy: ContractOfferLifecyclePolicy;
  contractOfferSpawnPolicy: ContractOfferSpawnPolicy;
  monthlySettlementPolicy: MonthlySettlementPolicy;
  probationEventResolver: ProbationEventResolver;
  salaryNegotiationResolver: SalaryNegotiationResolver;
  investmentReviewPolicy: InvestmentReviewPolicy;
  investmentResultResolver: InvestmentResultResolver;
  traitRevealPolicy: TraitRevealPolicy;
  traitProbabilisticEventPolicy: TraitProbabilisticEventPolicy;
}

export function createGameSessionDependencies(
  overrides: Partial<GameSessionDependencies> = {},
): GameSessionDependencies {
  const random = overrides.random ?? new MathRandomSource();
  return {
    random,
    employeeFactory: overrides.employeeFactory ?? new EmployeeFactory(random),
    projectFactory: overrides.projectFactory ?? new ProjectFactory(random),
    pendingEventFactory: overrides.pendingEventFactory ?? new PendingEventFactory(),
    crisisPolicy: overrides.crisisPolicy ?? new CrisisPolicy(),
    companyStageProgressionPolicy: overrides.companyStageProgressionPolicy ?? defaultCompanyStageProgressionPolicy,
    companyStagePressurePolicy: overrides.companyStagePressurePolicy ?? defaultCompanyStagePressurePolicy,
    companyStageInvestmentGatePolicy: overrides.companyStageInvestmentGatePolicy ?? defaultCompanyStageInvestmentGatePolicy,
    contractOfferLifecyclePolicy: overrides.contractOfferLifecyclePolicy ?? DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY,
    contractOfferSpawnPolicy: overrides.contractOfferSpawnPolicy ?? DEFAULT_CONTRACT_OFFER_SPAWN_POLICY,
    monthlySettlementPolicy: overrides.monthlySettlementPolicy ?? new MonthlySettlementPolicy(),
    probationEventResolver: overrides.probationEventResolver ?? new ProbationEventResolver(),
    salaryNegotiationResolver: overrides.salaryNegotiationResolver ?? new SalaryNegotiationResolver(),
    investmentReviewPolicy: overrides.investmentReviewPolicy ?? new InvestmentReviewPolicy(random),
    investmentResultResolver: overrides.investmentResultResolver ?? new InvestmentResultResolver(),
    traitRevealPolicy: overrides.traitRevealPolicy ?? new TraitRevealPolicy(),
    traitProbabilisticEventPolicy: overrides.traitProbabilisticEventPolicy ?? new TraitProbabilisticEventPolicy(random),
  };
}
