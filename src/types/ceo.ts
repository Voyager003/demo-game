export type Domain =
  | 'b2bsaas'
  | 'commerce'
  | 'community'
  | 'fintech'
  | 'healthcareit';

export interface CeoStats {
  leadership: number;       // 1~10: maxFatigue 결정
  negotiation: number;      // 1~10: 계약 협상 보너스
  vision: number;           // 1~10: 투자 IR, 핵심 인재 충성도
  techUnderstanding: number; // 1~10: CTO 없을 때 개발팀 생산성 보너스
  crisisResponse: number;   // 1~10: 긴급 이벤트 선택지 추가
}

export interface CEO {
  domain: Domain;
  stats: CeoStats;
}
