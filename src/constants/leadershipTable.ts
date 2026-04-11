// leadership 스탯 → 최대 피로도 (비선형 룩업 테이블)
// 공식이 아닌 테이블로 관리 (비선형 점프 있음)
export const LEADERSHIP_TO_MAX_FATIGUE: Record<number, number> = {
  1: 6,
  2: 7,
  3: 8,
  4: 9,
  5: 10,
  6: 12,
  7: 14,
  8: 16,
  9: 18,
  10: 20,
};
