import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { EconomyLedger } from '../../domain';

const ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

export function MainRevenuePanel() {
  const state = useGameStore((s) => s.state);
  const openModal = useUIStore((s) => s.openModal);
  if (!state) return null;

  const mainProject = state.activeProjects.find((p) => p.isMainRevenue);
  if (!mainProject) return null;

  const baseRevenue = mainProject.monthlyRevenue;
  const effectiveRevenue = EconomyLedger.effectiveRecurringRevenue(state.activeProjects, state.employees);
  const revenueRatio = baseRevenue > 0 ? Math.round((effectiveRevenue / baseRevenue) * 100) : 0;
  const isPhase2 = state.phase === 2;

  // 각 직원이 투입된 활성 프로젝트 수 집계
  const employeeProjectCount = new Map<string, number>();
  for (const project of state.activeProjects) {
    if (project.status !== 'active' && project.status !== 'operating') continue;
    for (const empId of project.assignedEmployeeIds) {
      employeeProjectCount.set(empId, (employeeProjectCount.get(empId) ?? 0) + 1);
    }
  }

  // 주수입원 배정 직원
  const assignedEmployees = state.employees.filter((e) =>
    mainProject.assignedEmployeeIds.includes(e.id),
  );

  // 케미 보정값 계산
  const avgComm = assignedEmployees.length > 0
    ? assignedEmployees.reduce((s, e) => s + e.commonStats.communication, 0) / assignedEmployees.length
    : 0;
  const chemBonus = Math.round(avgComm * 3);

  const revenueColor =
    revenueRatio >= 90 ? 'positive' :
    revenueRatio >= 60 ? '' :
    revenueRatio >= 30 ? 'warning' : 'danger';

  return (
    <div className="panel main-revenue-panel panel-span-2">
      <div className="main-revenue-header">
        <div>
          <h3 className="panel-title">주수입원</h3>
          <span className="main-revenue-name">{mainProject.name}</span>
          <span className="main-revenue-model muted">{mainProject.revenueLabel}</span>
        </div>
        {isPhase2 && (
          <button
            className="assign-btn"
            onClick={() => openModal('assignment', mainProject.id)}
          >
            배정 변경 (피로 -1)
          </button>
        )}
      </div>

      <div className="main-revenue-body">
        {/* 좌: 수익 정보 */}
        <div className="main-revenue-financials">
          <div className="stat-row">
            <span>기본 월 반복 수입</span>
            <span className="stat-value">+{baseRevenue.toLocaleString()}만원</span>
          </div>
          <div className="stat-row primary">
            <span>실효 수입 (현재 배정 기준)</span>
            <span className={`stat-value ${revenueColor}`}>
              +{effectiveRevenue.toLocaleString()}만원
            </span>
          </div>

          <div className="main-revenue-ratio-bar">
            <div className="main-revenue-ratio-track">
              <div
                className={`main-revenue-ratio-fill ${revenueColor}`}
                style={{ width: `${revenueRatio}%` }}
              />
            </div>
            <span className={`main-revenue-ratio-label ${revenueColor}`}>{revenueRatio}%</span>
          </div>

          {revenueRatio < 100 && (
            <p className="main-revenue-hint muted">
              외주 투입으로 인해 주수입원 집중도가 감소합니다.
            </p>
          )}

          <div className="stat-row">
            <span>케미 보정</span>
            <span className={`stat-value ${chemBonus >= 0 ? 'positive' : 'danger'}`}>
              {chemBonus >= 0 ? '+' : ''}{chemBonus}% (소통 avg {avgComm.toFixed(1)})
            </span>
          </div>
        </div>

        {/* 우: 배정 직원 */}
        <div className="main-revenue-employees">
          <p className="main-revenue-emp-title muted">
            배정 직원 {assignedEmployees.length}명 / 전체 {state.employees.length}명
          </p>
          {assignedEmployees.length === 0 ? (
            <p className="empty-text">배정된 직원이 없습니다. 수익이 발생하지 않습니다.</p>
          ) : (
            <div className="main-revenue-emp-list">
              {assignedEmployees.map((emp) => {
                const totalProjects = employeeProjectCount.get(emp.id) ?? 1;
                const contribution = Math.round((1 / totalProjects) * 100);
                return (
                  <div key={emp.id} className="main-revenue-emp-row">
                    <div className="main-revenue-emp-info">
                      <span className="emp-name">{emp.name}</span>
                      <span className="emp-role">{ROLE_LABELS[emp.role] ?? emp.role}</span>
                    </div>
                    <div className="main-revenue-emp-contrib">
                      <span className={`stat-value ${contribution >= 100 ? 'positive' : contribution >= 50 ? '' : 'warning'}`}>
                        {contribution}%
                      </span>
                      {totalProjects > 1 && (
                        <span className="muted" style={{ fontSize: '11px' }}>
                          ({totalProjects}개 프로젝트 병행)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 미배정 직원 표시 */}
          {state.employees.filter((e) => !mainProject.assignedEmployeeIds.includes(e.id)).length > 0 && (
            <div className="main-revenue-unassigned">
              <p className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
                미배정:{' '}
                {state.employees
                  .filter((e) => !mainProject.assignedEmployeeIds.includes(e.id))
                  .map((e) => e.name)
                  .join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
