export interface RandomSource {
  next(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}

export interface IdGenerator {
  next(prefix?: string): string;
}

export class TimestampIdGenerator implements IdGenerator {
  private readonly random: RandomSource;
  private readonly now: () => number;

  constructor(
    random: RandomSource = new MathRandomSource(),
    now: () => number = Date.now,
  ) {
    this.random = random;
    this.now = now;
  }

  next(prefix = ''): string {
    const randomPart = Math.floor(this.random.next() * Number.MAX_SAFE_INTEGER)
      .toString(36)
      .slice(0, 8);
    return `${prefix}${randomPart}${this.now().toString(36)}`;
  }
}
