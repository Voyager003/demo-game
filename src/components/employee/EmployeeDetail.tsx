import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getCommonStatGuide, getSpecialistStatGuide } from '../../constants/statGuides';
import { Modal } from '../shared/Modal';
import { SimpleStatBar, StatBar } from '../shared/StatBar';
import { ProjectSlotBar } from '../shared/ProjectSlotBar';

const ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

const SPECIALIST_LABELS: Record<string, Record<string, string>> = {
  developer: {
    codingSpeed: '구현속도',
    codeQuality: '코드품질',
    problemSolving: '문제해결력',
    techBreadth: '기술폭',
    securitySense: '보안감각',
  },
  designer: {
    uiSense: 'UI감각',
    uxThinking: 'UX사고력',
    workSpeed: '작업속도',
    brandingSense: '브랜딩감각',
    prototyping: '프로토타이핑',
  },
  pm: {
    scheduleManagement: '일정관리',
    requirementAnalysis: '요구사항분석',
    riskDetection: '리스크감지',
    clientManagement: '고객응대',
    teamCoordination: '팀조율력',
  },
};

const COMMON_LABELS: Record<string, string> = {
  stamina: '체력',
  communication: '소통',
  mental: '멘탈',
  growthRate: '성장속도',
  loyalty: '충성도',
};

export function EmployeeDetail() {
  const state = useGameStore((s) => s.state);
  const fireEmployee = useGameStore((s) => s.fireEmployee);
  const { modalType, modalTargetId, closeModal } = useUIStore();

  const isOpen = modalType === 'employee';
  const emp = isOpen && modalTargetId
    ? state?.employees.find((e) => e.id === modalTargetId)
    : null;

  if (!emp) return null;

  const specLabels = SPECIALIST_LABELS[emp.role] ?? {};
  const specEntries = Object.entries(emp.specialistStats);

  const handleFire = () => {
    fireEmployee(emp.id);
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={`${emp.name} — ${ROLE_LABELS[emp.role]}`} wide>
      <div className="employee-detail">
        <div className="detail-meta">
          <span>{emp.employmentType === 'regular' ? '정규직' : '계약직'}</span>
          {emp.probationTurnsLeft > 0 && (
            <span className="probation-tag">수습 {emp.probationTurnsLeft}턴 남음</span>
          )}
          <span>연봉: {emp.salary.toLocaleString()}만원</span>
          <span>HP: {emp.hp}</span>
        </div>

        <div className="detail-sections">
          {/* 전문 스탯 */}
          <div className="detail-section">
            <h4>전문 스탯</h4>
            {specEntries.map(([key, val]) => (
              <SimpleStatBar
                key={key}
                label={specLabels[key] ?? key}
                value={val as number}
                max={10}
                tooltip={getSpecialistStatGuide(emp.role, key)}
              />
            ))}
          </div>

          {/* 공통 스탯 */}
          <div className="detail-section">
            <h4>공통 스탯</h4>
            {Object.entries(emp.commonStats).map(([key, val]) => (
              <StatBar
                key={key}
                label={COMMON_LABELS[key] ?? key}
                value={val}
                min={-1}
                max={5}
                tooltip={getCommonStatGuide(key as keyof typeof emp.commonStats)}
              />
            ))}
            <div className="detail-slot-row">
              <span className="detail-slot-label">동시 투입가능 프로젝트</span>
              <ProjectSlotBar max={emp.maxConcurrentProjects} />
            </div>
          </div>

        </div>

        <div className="detail-actions">
          <button className="fire-btn" onClick={handleFire}>
            해고 (피로 -2)
          </button>
        </div>
      </div>
    </Modal>
  );
}
