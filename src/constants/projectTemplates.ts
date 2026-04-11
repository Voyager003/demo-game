import type { ProjectLevel } from '../types/project';

export interface ProjectTemplate {
  name: string;
  level: ProjectLevel;
  minAmount: number; // 총 금액 하한 (만원)
  maxAmount: number; // 총 금액 상한 (만원)
  minTurns: number;  // 소요 턴 수 하한
  maxTurns: number;  // 소요 턴 수 상한
  description: string;
}

// Lv1: 팀 개발자 스탯 합산 10~19 수준 (랜딩페이지, 단순 어드민 등)
export const LV1_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: '기업 랜딩페이지 제작',
    level: 1,
    minAmount: 700,
    maxAmount: 1000,
    minTurns: 4,
    maxTurns: 5,
    description: '중소기업 브랜딩 랜딩페이지. 반응형 지원 필요.',
  },
  {
    name: '사내 게시판 시스템',
    level: 1,
    minAmount: 800,
    maxAmount: 1100,
    minTurns: 4,
    maxTurns: 6,
    description: '공지사항 및 자료실 기능의 사내 인트라넷 게시판.',
  },
  {
    name: '재고 관리 어드민 툴',
    level: 1,
    minAmount: 900,
    maxAmount: 1200,
    minTurns: 5,
    maxTurns: 6,
    description: '소매업체 재고 입출고 관리 및 리포트 시스템.',
  },
  {
    name: '예약 캘린더 위젯',
    level: 1,
    minAmount: 700,
    maxAmount: 950,
    minTurns: 4,
    maxTurns: 5,
    description: '미용실/병원 예약 관리 달력 위젯 개발.',
  },
  {
    name: '온라인 설문조사 플랫폼',
    level: 1,
    minAmount: 800,
    maxAmount: 1050,
    minTurns: 4,
    maxTurns: 5,
    description: '다양한 문항 유형 지원하는 설문 생성 및 결과 분석 도구.',
  },
  {
    name: '직원 근태 관리 시스템',
    level: 1,
    minAmount: 850,
    maxAmount: 1150,
    minTurns: 5,
    maxTurns: 6,
    description: '출퇴근 기록, 휴가 신청, 급여 연동 근태 관리 솔루션.',
  },
];

// Lv2: 팀 개발자 스탯 합산 20~34 수준 (이커머스, 예약 시스템 등)
export const LV2_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    name: '소규모 쇼핑몰 플랫폼',
    level: 2,
    minAmount: 1800,
    maxAmount: 2800,
    minTurns: 7,
    maxTurns: 10,
    description: '상품 관리, 장바구니, 결제 연동 포함한 이커머스 솔루션.',
  },
  {
    name: '숙박 예약 시스템',
    level: 2,
    minAmount: 1600,
    maxAmount: 2400,
    minTurns: 6,
    maxTurns: 9,
    description: '달력 기반 객실 예약 및 관리자 대시보드.',
  },
  {
    name: '병원 전자차트 연동 모듈',
    level: 2,
    minAmount: 2000,
    maxAmount: 3000,
    minTurns: 8,
    maxTurns: 11,
    description: '기존 EMR 시스템과 연동되는 외래 환자 관리 모듈.',
  },
  {
    name: 'B2B 발주 관리 포털',
    level: 2,
    minAmount: 1700,
    maxAmount: 2500,
    minTurns: 7,
    maxTurns: 9,
    description: '복수 공급업체 대상 발주, 납품 확인, 정산 관리 포털.',
  },
];
