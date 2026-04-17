import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { TurnHeader } from '../turn/TurnHeader';
import { ActionMenu } from '../turn/ActionMenu';
import { TurnReportModal } from '../turn/TurnReportModal';
import { FinancialPanel } from './FinancialPanel';
import { TeamPanel } from './TeamPanel';
import { EventLogPanel } from './EventLogPanel';
import { FunctionLogPanel } from './FunctionLogPanel';
import { AlertPanel } from './AlertPanel';
import { ProjectCard } from '../project/ProjectCard';
import { EventModal } from '../events/EventModal';
import { EmployeeDetail } from '../employee/EmployeeDetail';
import { ResumeListModal } from '../employee/ResumeCard';
import { AssignmentModal } from '../project/AssignmentModal';

export function Dashboard() {
  const state = useGameStore((s) => s.state);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const signContract = useGameStore((s) => s.signContract);
  const openModal = useUIStore((s) => s.openModal);

  if (!state) return null;

  const isPhase1 = state.phase === 1;
  const isPhase2 = state.phase === 2;
  const isPhase5 = state.phase === 5;

  return (
    <div className="dashboard">
      <TurnHeader />

      <div className="dashboard-body">
        {/* 좌측: 액션/이벤트 처리 */}
        <aside className="dashboard-sidebar">
          {isPhase1 && (
            <div className="phase1-panel">
              <h3>이벤트 확인</h3>
              <p className="muted">
                {state.pendingEvents.length > 0
                  ? `${state.pendingEvents.length}개의 이벤트가 있습니다.`
                  : '이번 턴 이벤트 없음'}
              </p>
              <button className="advance-btn" onClick={advancePhase}>
                의사결정 Phase로 →
              </button>
            </div>
          )}
          {isPhase2 && <ActionMenu />}
          {isPhase5 && <TurnReportModal />}
        </aside>

        {/* 메인: 패널 그리드 */}
        <main className="dashboard-main">
          <div className="panel-grid">
            <FinancialPanel />
            <TeamPanel />
            <AlertPanel />
            <EventLogPanel />
            <FunctionLogPanel />
          </div>

          {/* 프로젝트 섹션 */}
          <div className="projects-section">
            {state.availableProjects.length > 0 && (
              <div className="projects-group">
                <h3 className="section-title">계약 가능한 프로젝트</h3>
                <div className="project-list">
                  {state.availableProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onSign={isPhase2 ? signContract : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {state.activeProjects.length > 0 && (
              <div className="projects-group">
                <h3 className="section-title">진행 중인 프로젝트</h3>
                <div className="project-list">
                  {state.activeProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onAssign={isPhase2 ? (id) => openModal('assignment', id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 모달들 */}
      <EventModal />
      <EmployeeDetail />
      <ResumeListModal />
      <AssignmentModal />
    </div>
  );
}
