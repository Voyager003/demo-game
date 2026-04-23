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
      [4, 4, 5, 4, 5, 1, 2, 3, 0, 1, 4100, 2],
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
    });
  });

  it('creates projects through injected id and random providers', () => {
    const random = new StubRandomSource([1600, 5], [0]);
    const ids = new StubIdGenerator(['project-1', 'main-1']);
    const factory = new ProjectFactory(random, ids);

    const [contract] = factory.generateInitialProjects(1);
    const main = factory.generateMainRevenueProject('fintech');

    expect(contract).toMatchObject({
      id: 'project-1',
      kind: 'contract',
      totalAmount: 1000,
      turnsRequired: 5,
      status: 'available',
    });
    expect(main).toMatchObject({
      id: 'main_fintech_main-1',
      kind: 'ownedProduct',
      status: 'operating',
      monthlyRevenue: 380,
    });
  });
});
