import { useGameStore } from '../../store/gameStore';
import { EconomyLedger } from '../../domain';

export function FinancialPanel() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const salaries = EconomyLedger.monthlySalaries(state.employees);
  const operating = EconomyLedger.monthlyOperatingCosts(state.employees.length);
  const monthlyBurn = salaries + operating;
  const runway = EconomyLedger.runwayInTurns(state.capital, monthlyBurn);

  const runwayClass =
    runway === Infinity ? 'positive' :
    runway < 4 ? 'danger' :
    runway < 12 ? 'warning' : '';

  // 이번 달 예상 수령 (진행 중 프로젝트)
  const pendingIncome = state.activeProjects
    .filter((p) => p.status === 'active' && !p.finalPaid)
    .reduce((sum, p) => {
      const remaining = p.turnsRequired - p.turnsElapsed;
      if (remaining <= 4) {
        return sum + Math.round(p.totalAmount * 0.7);
      }
      return sum;
    }, 0);

  return (
    <div className="panel financial-panel">
      <h3 className="panel-title">재무 현황</h3>

      <div className="stat-row primary">
        <span>자본 잔액</span>
        <span className={`stat-value ${state.capital < 500 ? 'danger' : ''}`}>
          {state.capital.toLocaleString()}만원
        </span>
      </div>

      <div className="divider" />

      <div className="stat-row">
        <span>인건비 (월)</span>
        <span className="stat-value muted">-{salaries.toLocaleString()}만원</span>
      </div>
      <div className="stat-row">
        <span>운영비 (월)</span>
        <span className="stat-value muted">-{operating.toLocaleString()}만원</span>
      </div>
      <div className="stat-row">
        <span>월 총 지출</span>
        <span className="stat-value">-{monthlyBurn.toLocaleString()}만원</span>
      </div>

      {pendingIncome > 0 && (
        <div className="stat-row">
          <span>납기 임박 예상 수익</span>
          <span className="stat-value positive">+{pendingIncome.toLocaleString()}만원</span>
        </div>
      )}

      <div className="divider" />

      <div className="stat-row">
        <span>런웨이</span>
        <span className={`stat-value ${runwayClass}`}>
          {runway === Infinity
            ? '흑자 운영'
            : runway === 0
            ? '즉시 위기'
            : `약 ${runway}턴 (${Math.floor(runway / 4)}개월)`}
        </span>
      </div>

      {state.gameStatus === 'crisis' && (
        <div className="crisis-bar">
          위기 유예: {state.crisisGraceTurnsLeft}턴 남음
        </div>
      )}
    </div>
  );
}
