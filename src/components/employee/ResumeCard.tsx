import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getCommonStatGuide, getSpecialistStatGuide } from '../../constants/statGuides';
import { getTraitGuide, getTraitHintLabel } from '../../constants/traitGuides';
import { getRevealedTraitDefinitions } from '../../domain/traits';
import { HoverInfo } from '../shared/HoverInfo';
import { Modal } from '../shared/Modal';
import { SimpleStatBar, StatBar } from '../shared/StatBar';
import { ProjectSlotBar } from '../shared/ProjectSlotBar';
import type { Employee } from '../../types/employee';

const ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

const SPECIALIST_LABELS: Record<string, Record<string, string>> = {
  developer: { codingSpeed: '구현속도', codeQuality: '코드품질', problemSolving: '문제해결력', techBreadth: '기술폭', securitySense: '보안감각' },
  designer: { uiSense: 'UI감각', uxThinking: 'UX사고력', workSpeed: '작업속도', brandingSense: '브랜딩감각', prototyping: '프로토타이핑' },
  pm: { scheduleManagement: '일정관리', requirementAnalysis: '요구사항분석', riskDetection: '리스크감지', clientManagement: '고객응대', teamCoordination: '팀조율력' },
};

interface ResumeItemProps {
  candidate: Employee;
  onHire: (id: string) => void;
}

function ResumeItem({ candidate, onHire }: ResumeItemProps) {
  const specLabels = SPECIALIST_LABELS[candidate.role] ?? {};
  const specSum = Object.values(candidate.specialistStats).reduce((a, b) => a + (b as number), 0);
  const revealedTraits = getRevealedTraitDefinitions(candidate.traitProfile);

  return (
    <div className="resume-item">
      <div className="resume-header">
        <div>
          <span className="resume-name">{candidate.name}</span>
          <span className="resume-role">{ROLE_LABELS[candidate.role]}</span>
        </div>
        <span className="resume-salary">{candidate.salary.toLocaleString()}만원/년</span>
      </div>

      <div className="resume-stats">
        {Object.entries(candidate.specialistStats).slice(0, 3).map(([key, val]) => (
          <SimpleStatBar
            key={key}
            label={specLabels[key] ?? key}
            value={val as number}
            max={10}
            tooltip={getSpecialistStatGuide(candidate.role, key)}
          />
        ))}
        <span className="spec-sum">전문 스탯 합계: {specSum}</span>
      </div>

      <div className="resume-common">
        {(['stamina', 'communication', 'loyalty'] as const).map((key) => (
          <StatBar
            key={key}
            label={key === 'stamina' ? '체력' : key === 'communication' ? '소통' : '충성도'}
            value={candidate.commonStats[key]}
            min={-1}
            max={5}
            tooltip={getCommonStatGuide(key)}
          />
        ))}
        <div className="resume-concurrent">
          <span className="muted">동시 투입가능 프로젝트</span>
          <ProjectSlotBar max={candidate.maxConcurrentProjects} />
        </div>
      </div>

      <div className="trait-chip-row">
        {revealedTraits.map((trait) => (
          <HoverInfo
            key={trait.id}
            label={getTraitGuide(trait.id).label}
            description={getTraitGuide(trait.id).description}
            deterministicImpact={getTraitGuide(trait.id).deterministicImpact}
          >
            <span className="trait-chip revealed">{trait.label}</span>
          </HoverInfo>
        ))}
        {candidate.traitProfile.reveal.hints.map((hint) => (
          <span key={`${hint.category}:${hint.text}`} className="trait-chip hidden">
            {getTraitHintLabel(hint)}: {hint.text}
          </span>
        ))}
      </div>

      <button className="hire-btn" onClick={() => onHire(candidate.id)}>
        채용 (피로 -2)
      </button>
    </div>
  );
}

export function ResumeListModal() {
  const state = useGameStore((s) => s.state);
  const conductInterview = useGameStore((s) => s.conductInterview);
  const { modalType, closeModal } = useUIStore();

  const isOpen = modalType === 'resume';

  if (!isOpen || !state) return null;

  const handleHire = (id: string) => {
    conductInterview(id);
    if (state.pendingResumes.length <= 1) closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="채용 이력서 검토" wide>
      {state.pendingResumes.length === 0 ? (
        <p className="empty-text">검토 가능한 이력서 없음. 채용 공고를 게시하세요.</p>
      ) : (
        <div className="resume-list">
          {state.pendingResumes.map((candidate) => (
            <ResumeItem
              key={candidate.id}
              candidate={candidate}
              onHire={handleHire}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
