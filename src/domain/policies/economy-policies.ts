export interface SatisfactionThreshold {
  min: number;
  multiplier: number;
}

export class OperatingCostPolicy {
  private readonly baseCost: number;
  private readonly perEmployeeCost: number;

  constructor(
    baseCost = 200,
    perEmployeeCost = 50,
  ) {
    this.baseCost = baseCost;
    this.perEmployeeCost = perEmployeeCost;
  }

  monthlyCost(employeeCount: number): number {
    return this.baseCost + employeeCount * this.perEmployeeCost;
  }
}

export class SatisfactionMultiplierPolicy {
  private readonly thresholds: SatisfactionThreshold[];

  constructor(
    thresholds: SatisfactionThreshold[] = [
      { min: 90, multiplier: 1.05 },
      { min: 70, multiplier: 1 },
      { min: 50, multiplier: 0.9 },
      { min: 30, multiplier: 0.7 },
      { min: Number.NEGATIVE_INFINITY, multiplier: 0.5 },
    ],
  ) {
    this.thresholds = thresholds;
  }

  multiplierFor(satisfaction: number): number {
    return this.thresholds.find((threshold) => satisfaction >= threshold.min)?.multiplier ?? 1;
  }
}

export class FinalPaymentPolicy {
  private readonly finalRatio: number;
  private readonly satisfactionMultiplier: SatisfactionMultiplierPolicy;

  constructor(
    finalRatio = 0.7,
    satisfactionMultiplier = new SatisfactionMultiplierPolicy(),
  ) {
    this.finalRatio = finalRatio;
    this.satisfactionMultiplier = satisfactionMultiplier;
  }

  payment(totalAmount: number, clientSatisfaction: number): number {
    return Math.round(
      totalAmount * this.finalRatio * this.satisfactionMultiplier.multiplierFor(clientSatisfaction),
    );
  }
}

export class RunwayPolicy {
  private readonly turnsPerMonth: number;

  constructor(turnsPerMonth = 4) {
    this.turnsPerMonth = turnsPerMonth;
  }

  turns(capital: number, monthlyBurn: number): number {
    if (monthlyBurn <= 0) return Infinity;
    return Math.max(0, Math.floor((capital / monthlyBurn) * this.turnsPerMonth));
  }
}

export const DEFAULT_OPERATING_COST_POLICY = new OperatingCostPolicy();
export const DEFAULT_SATISFACTION_MULTIPLIER_POLICY = new SatisfactionMultiplierPolicy();
export const DEFAULT_FINAL_PAYMENT_POLICY = new FinalPaymentPolicy(
  0.7,
  DEFAULT_SATISFACTION_MULTIPLIER_POLICY,
);
export const DEFAULT_RUNWAY_POLICY = new RunwayPolicy();
