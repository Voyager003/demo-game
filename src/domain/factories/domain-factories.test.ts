import { describe, expect, it } from 'vitest';
import { EmployeeFactory } from './employee-factory';
import { ProjectFactory } from './project-factory';
import type { IdGenerator, RandomSource } from '../generation';

class StubRandomSource implements RandomSource {
  private readonly ints: number[];
  private readonly picks: number[];

  constructor(
    ints: number[] = [],
    picks: number[] = [],
  ) {
    this.ints = ints;
    this.picks = picks;
  }

  next(): number {
    return 0;
  }

  nextInt(min: number, max: number): number {
    const value = this.ints.shift() ?? min;
    return Math.max(min, Math.min(max, value));
  }

  pick<T>(items: readonly T[]): T {
    const index = this.picks.shift() ?? 0;
    return items[index] ?? items[0];
  }
}

class StubIdGenerator implements IdGenerator {
  private readonly ids: string[];

  constructor(ids: string[]) {
    this.ids = ids;
  }

  next(prefix = ''): string {
    return `${prefix}${this.ids.shift() ?? 'generated'}`;
  }
}

describe('domain factories', () => {
  it('creates employees through injected id and random providers', () => {
    const random = new StubRandomSource(
      [4100, 2],
      [1, 2],
    );
    const ids = new StubIdGenerator(['emp-1']);
    const factory = new EmployeeFactory(random, ids);

    const candidate = factory.createCandidate('designer', 2, 7);

    expect(candidate).toMatchObject({
      id: 'emp-1',
      name: '이도현',
      role: 'designer',
      probationTurnsLeft: 12,
      salary: 4100,
      maxConcurrentProjects: 2,
      hiredOnTurn: 7,
      commonStats: expect.objectContaining({ loyalty: 0 }),
    });
    expect(Object.values(candidate.specialistStats).reduce((sum, value) => sum + value, 0)).toBe(25);
    expect(
      candidate.commonStats.stamina
      + candidate.commonStats.communication
      + candidate.commonStats.mental
      + candidate.commonStats.growthRate
      + candidate.commonStats.loyalty,
    ).toBe(4);
  });

  it('creates projects through injected id and random providers', () => {
    const random = new StubRandomSource([700, 4, 5], [0]);
    const ids = new StubIdGenerator(['project-1', 'main-1']);
    const factory = new ProjectFactory(random, ids);

    const [contract] = factory.generateInitialProjects(1, 3);
    const main = factory.generateMainRevenueProject('fintech');

    expect(contract).toMatchObject({
      id: 'project-1',
      kind: 'contract',
      totalAmount: 700,
      turnsRequired: 5,
      status: 'available',
      offeredAtTurn: 3,
      expiresAtTurn: 8,
    });
    expect(main).toMatchObject({
      id: 'main_fintech_main-1',
      kind: 'ownedProduct',
      status: 'operating',
      monthlyRevenue: 380,
    });
  });
});
