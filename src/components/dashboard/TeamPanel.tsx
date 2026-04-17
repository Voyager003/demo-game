import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

const ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

export function TeamPanel() {
  const state = useGameStore((s) => s.state);
  const { openModal } = useUIStore();
  if (!state) return null;

  return (
    <div className="panel team-panel">
      <h3 className="panel-title">팀 현황</h3>

      <div className="stat-row">
        <span>총 인원</span>
        <span className="stat-value">{state.employees.length}명</span>
      </div>
      <div className="divider" />

      {state.employees.length === 0 ? (
        <p className="empty-text">직원이 없습니다. 채용 공고를 게시하세요.</p>
      ) : (
        <div className="employee-list">
          {state.employees.map((emp) => (
            <div
              key={emp.id}
              className="employee-card-mini"
              onClick={() => openModal('employee', emp.id)}
            >
              <div className="emp-name-row">
                <span className="emp-name">{emp.name}</span>
                <span className="emp-role">{ROLE_LABELS[emp.role]}</span>
              </div>
              <div className="emp-meta">
                {emp.probationTurnsLeft > 0 && (
                  <span className="probation-badge">수습 {emp.probationTurnsLeft}턴</span>
                )}
                <span className="emp-salary">{emp.salary.toLocaleString()}만원</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {state.pendingResumes.length > 0 && (
        <div className="resume-notice" onClick={() => openModal('resume')}>
          이력서 {state.pendingResumes.length}장 검토 대기 중 →
        </div>
      )}
    </div>
  );
}
