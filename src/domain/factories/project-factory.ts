import { LV1_PROJECT_TEMPLATES } from '../../constants/projectTemplates';
import type { Domain } from '../../types/ceo';
import type { Project, ProjectRevenueModel } from '../../types/project';
import type { IdGenerator, RandomSource } from '../generation';
import { MathRandomSource, TimestampIdGenerator } from '../generation';
import {
  DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY,
  type ContractOfferLifecyclePolicy,
} from '../policies/project-policies';

const MAIN_REVENUE_PROJECTS: Record<
  Domain,
  Pick<Project, 'name' | 'monthlyRevenue' | 'revenueModel' | 'revenueLabel'>
> = {
  b2bsaas: {
    name: 'B2B 업무 자동화 SaaS',
    monthlyRevenue: 320,
    revenueModel: 'subscription',
    revenueLabel: 'MRR 구독 매출',
  },
  commerce: {
    name: '니치 커머스 운영 플랫폼',
    monthlyRevenue: 280,
    revenueModel: 'commission',
    revenueLabel: '거래 수수료 매출',
  },
  community: {
    name: '콘텐츠 커뮤니티 광고 네트워크',
    monthlyRevenue: 180,
    revenueModel: 'ads',
    revenueLabel: '광고 매출',
  },
  fintech: {
    name: '핀테크 정산 API',
    monthlyRevenue: 380,
    revenueModel: 'subscription',
    revenueLabel: 'API 사용료 매출',
  },
  healthcareit: {
    name: '클리닉 예약/문진 서비스',
    monthlyRevenue: 300,
    revenueModel: 'subscription',
    revenueLabel: '의료기관 구독 매출',
  },
};

export class ProjectFactory {
  private readonly random: RandomSource;
  private readonly ids: IdGenerator;

  constructor(
    random: RandomSource = new MathRandomSource(),
    ids: IdGenerator = new TimestampIdGenerator(),
  ) {
    this.random = random;
    this.ids = ids;
  }

  generateMainRevenueProject(domain: Domain): Project {
    const template = MAIN_REVENUE_PROJECTS[domain];
    return {
      id: this.ids.next(`main_${domain}_`),
      name: template.name,
      kind: 'ownedProduct',
      level: 1,
      totalAmount: 0,
      monthlyRevenue: template.monthlyRevenue,
      revenueModel: template.revenueModel as ProjectRevenueModel,
      revenueLabel: template.revenueLabel,
      isMainRevenue: true,
      advancePaid: true,
      finalPaid: true,
      turnsRequired: 0,
      turnsElapsed: 0,
      progress: 100,
      assignedEmployeeIds: [],
      status: 'operating',
      clientSatisfaction: 100,
      overtimeActive: false,
      offeredAtTurn: null,
      expiresAtTurn: null,
    };
  }

  generateInitialProjects(
    count = 3,
    currentTurn = 1,
    lifecyclePolicy: ContractOfferLifecyclePolicy = DEFAULT_CONTRACT_OFFER_LIFECYCLE_POLICY,
  ): Project[] {
    const projects: Project[] = [];
    for (let index = 0; index < count; index += 1) {
      const template = this.random.pick(LV1_PROJECT_TEMPLATES);
      const offerWindow = lifecyclePolicy.createOfferWindow(currentTurn, this.random);
      projects.push({
        id: this.ids.next(),
        name: template.name,
        kind: 'contract',
        level: 1,
        totalAmount: this.random.nextInt(template.minAmount, template.maxAmount),
        monthlyRevenue: 0,
        revenueModel: 'contract',
        revenueLabel: '외주 선금/잔금',
        isMainRevenue: false,
        advancePaid: false,
        finalPaid: false,
        turnsRequired: this.random.nextInt(template.minTurns, template.maxTurns),
        turnsElapsed: 0,
        progress: 0,
        assignedEmployeeIds: [],
        status: 'available',
        clientSatisfaction: 0,
        overtimeActive: false,
        offeredAtTurn: offerWindow.offeredAtTurn,
        expiresAtTurn: offerWindow.expiresAtTurn,
      });
    }
    return projects;
  }
}

export const defaultProjectFactory = new ProjectFactory();
