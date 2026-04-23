import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { buildMainRevenueViewModel } from './mainRevenue.view-model';

export function MainRevenuePanel() {
  const state = useGameStore((s) => s.state);
  const openModal = useUIStore((s) => s.openModal);
  if (!state) return null;

  const viewModel = buildMainRevenueViewModel(state);
  if (!viewModel) return null;

  return (
    <div className="panel main-revenue-panel panel-span-2">
      <div className="main-revenue-header">
        <div>
          <h3 className="panel-title">주수입원</h3>
          <span className="main-revenue-name">{viewModel.mainProject.name}</span>
          <span className="main-revenue-model muted">{viewModel.mainProject.revenueLabel}</span>
        </div>
        {viewModel.isPhase2 && (
          <button
            className="assign-btn"
            onClick={() => openModal('assignment', viewModel.mainProject.id)}
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
            <span className="stat-value">+{viewModel.baseRevenue.toLocaleString()}만원</span>
          </div>
          <div className="stat-row primary">
            <span>실효 수입 (현재 배정 기준)</span>
            <span className={`stat-value ${viewModel.revenueColor}`}>
              +{viewModel.effectiveRevenue.toLocaleString()}만원
            </span>
          </div>

          <div className="main-revenue-ratio-bar">
            <div className="main-revenue-ratio-track">
              <div
                className={`main-revenue-ratio-fill ${viewModel.revenueColor}`}
                style={{ width: `${viewModel.revenueRatio}%` }}
              />
            </div>
            <span className={`main-revenue-ratio-label ${viewModel.revenueColor}`}>{viewModel.revenueRatio}%</span>
          </div>

          {viewModel.revenueRatio < 100 && (
            <p className="main-revenue-hint muted">
              외주 투입으로 인해 주수입원 집중도가 감소합니다.
            </p>
          )}

          <div className="stat-row">
            <span>케미 보정</span>
            <span className={`stat-value ${viewModel.chemBonus >= 0 ? 'positive' : 'danger'}`}>
              {viewModel.chemBonus >= 0 ? '+' : ''}{viewModel.chemBonus}% (소통 avg {viewModel.avgCommunication.toFixed(1)})
            </span>
          </div>
        </div>

        {/* 우: 배정 직원 */}
        <div className="main-revenue-employees">
          <p className="main-revenue-emp-title muted">
            배정 직원 {viewModel.assignedEmployees.length}명 / 전체 {state.employees.length}명
          </p>
          {viewModel.assignedEmployees.length === 0 ? (
            <p className="empty-text">배정된 직원이 없습니다. 수익이 발생하지 않습니다.</p>
          ) : (
            <div className="main-revenue-emp-list">
              {viewModel.employeeContributions.map(({ employee, roleLabel, totalProjects, contribution }) => {
                return (
                  <div key={employee.id} className="main-revenue-emp-row">
                    <div className="main-revenue-emp-info">
                      <span className="emp-name">{employee.name}</span>
                      <span className="emp-role">{roleLabel}</span>
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
          {viewModel.unassignedEmployeeNames.length > 0 && (
            <div className="main-revenue-unassigned">
              <p className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
                미배정: {viewModel.unassignedEmployeeNames.join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
