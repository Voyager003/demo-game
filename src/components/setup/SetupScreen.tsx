import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DOMAIN_LABELS, DOMAIN_DESCRIPTIONS, DOMAIN_INITIAL_STATS } from '../../constants/domainStats';
import { SimpleStatBar, StatBar } from '../shared/StatBar';
import { EmployeeRoster, maxFatigueForLeadership } from '../../domain';
import { ProjectSlotBar } from '../shared/ProjectSlotBar';
import type { Domain } from '../../types/ceo';
import type { Employee, DeveloperStats } from '../../types/employee';

const DOMAINS: Domain[] = ['b2bsaas', 'commerce', 'community', 'fintech', 'healthcareit'];

const STAT_LABELS: Record<string, string> = {
  leadership: '리더십',
  negotiation: '협상력',
  vision: '비전',
  techUnderstanding: '기술이해도',
  crisisResponse: '위기대응력',
};

const DEV_STAT_LABELS: Record<string, string> = {
  codingSpeed: '구현속도',
  codeQuality: '코드품질',
  problemSolving: '문제해결력',
  techBreadth: '기술폭',
  securitySense: '보안감각',
};

const COMMON_LABELS: Record<string, string> = {
  stamina: '체력',
  communication: '소통',
  mental: '멘탈',
  growthRate: '성장속도',
  loyalty: '충성도',
};

type Step = 'domain' | 'founding-member';

// 창업 멤버 이력서 카드
function FoundingMemberCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: Employee;
  selected: boolean;
  onSelect: () => void;
}) {
  const stats = candidate.specialistStats as DeveloperStats;
  const specSum = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <button
      className={`founding-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="founding-card-header">
        <div>
          <span className="founding-name">{candidate.name}</span>
          <span className="founding-role">개발자</span>
        </div>
        <span className="founding-salary">{candidate.salary.toLocaleString()}만원/년</span>
      </div>

      <div className="founding-stats">
        {Object.entries(stats).map(([key, val]) => (
          <SimpleStatBar
            key={key}
            label={DEV_STAT_LABELS[key] ?? key}
            value={val}
            max={10}
          />
        ))}
        <div className="spec-sum">전문 스탯 합계: {specSum}</div>
      </div>

      <div className="founding-common">
        {(['stamina', 'communication', 'mental'] as const).map((key) => (
          <StatBar
            key={key}
            label={COMMON_LABELS[key]}
            value={candidate.commonStats[key]}
            min={-1}
            max={5}
          />
        ))}
        <div className="founding-concurrent">
          <span>동시 투입가능 프로젝트</span>
          <ProjectSlotBar max={candidate.maxConcurrentProjects} />
        </div>
      </div>

      {selected && <div className="founding-selected-mark">선택됨 ✓</div>}
    </button>
  );
}

export function SetupScreen() {
  const [step, setStep] = useState<Step>('domain');
  const [selectedDomain, setSelectedDomain] = useState<Domain>('b2bsaas');
  const [companyName, setCompanyName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const initGame = useGameStore((s) => s.initGame);

  // 이력서 3장 — domain이 바뀌어도 step이 'founding-member'로 넘어간 뒤에는 고정
  const candidates = useMemo(
    () => EmployeeRoster.generateFoundingCandidates(3, 30, 1),
    [],
  );

  const stats = DOMAIN_INITIAL_STATS[selectedDomain];
  const maxFatigue = maxFatigueForLeadership(stats.leadership);

  const handleNextStep = () => {
    setStep('founding-member');
  };

  const handleStart = () => {
    const member = candidates.find((c) => c.id === selectedMemberId);
    if (!member) return;
    const name = companyName.trim() || '무명 스타트업';
    initGame(selectedDomain, name, member);
  };

  // ─── Step 1: 도메인 & 회사명 ──────────────────────────────────
  if (step === 'domain') {
    return (
      <div className="setup-screen">
        <div className="setup-container">
          <h1 className="setup-title">IT 스타트업 시뮬레이션</h1>
          <p className="setup-subtitle">Step 1 / 2 — 도메인과 회사명을 선택하세요</p>

          <div className="setup-domains">
            {DOMAINS.map((domain) => (
              <button
                key={domain}
                className={`domain-card ${selectedDomain === domain ? 'selected' : ''}`}
                onClick={() => setSelectedDomain(domain)}
              >
                <span className="domain-name">{DOMAIN_LABELS[domain]}</span>
                <span className="domain-desc">{DOMAIN_DESCRIPTIONS[domain]}</span>
              </button>
            ))}
          </div>

          <div className="setup-stats-preview">
            <h3>선택된 도메인: {DOMAIN_LABELS[selectedDomain]}</h3>
            <div className="stats-grid">
              {Object.entries(stats).map(([key, val]) => (
                <SimpleStatBar
                  key={key}
                  label={STAT_LABELS[key] ?? key}
                  value={val}
                  max={10}
                />
              ))}
            </div>
            <div className="setup-meta-row">
              <span>초기 피로도: <strong>{maxFatigue}</strong></span>
              <span>초기 자본: <strong>2,000만원</strong></span>
            </div>
          </div>

          <div className="setup-form">
            <label className="setup-label">
              회사명
              <input
                type="text"
                className="setup-input"
                placeholder="무명 스타트업"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={20}
              />
            </label>
            <button className="start-btn" onClick={handleNextStep}>
              다음: 창업 멤버 선택 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: 창업 멤버 선택 ───────────────────────────────────
  return (
    <div className="setup-screen">
      <div className="setup-container wide">
        <div className="setup-step2-header">
          <button className="back-btn" onClick={() => setStep('domain')}>
            ← 뒤로
          </button>
          <div>
            <h1 className="setup-title">창업 멤버 선택</h1>
            <p className="setup-subtitle">
              Step 2 / 2 — 함께 시작할 개발자 1명을 선택하세요
            </p>
          </div>
        </div>

        <div className="founding-notice">
          창업 멤버는 <strong>수습 없이 정규직</strong>으로 시작하며, 모든 특성이 공개됩니다.
          충성도 +2 보너스가 적용됩니다.
        </div>

        <div className="founding-candidates">
          {candidates.map((candidate) => (
            <FoundingMemberCard
              key={candidate.id}
              candidate={candidate}
              selected={selectedMemberId === candidate.id}
              onSelect={() => setSelectedMemberId(candidate.id)}
            />
          ))}
        </div>

        <div className="setup-form">
          <button
            className="start-btn"
            onClick={handleStart}
            disabled={!selectedMemberId}
          >
            {selectedMemberId ? '게임 시작 →' : '멤버를 선택하세요'}
          </button>
        </div>
      </div>
    </div>
  );
}
