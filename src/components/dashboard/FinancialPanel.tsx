import { useGameStore } from '../../store/gameStore';
import { EconomyLedger } from '../../domain';

export function FinancialPanel() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const salaries = EconomyLedger.monthlySalaries(state.employees);
  const operating = EconomyLedger.monthlyOperatingCosts(state.employees.length);
  const monthlyBurn = EconomyLedger.monthlyBurn(state.employees);
  const recurringRevenue = EconomyLedger.effectiveRecurringRevenue(state.activeProjects, state.employees);
  const monthlyNetBurn = EconomyLedger.effectiveMonthlyNetBurn(state.employees, state.activeProjects);
  const runway = EconomyLedger.runwayInTurns(state.capital, monthlyNetBurn);

  const pendingIncome = state.activeProjects
    .filter((p) => p.status === 'active' && !p.finalPaid)
    .reduce((sum, p) => {
      const remaining = p.turnsRequired - p.turnsElapsed;
      if (remaining <= 4) return sum + Math.round(p.totalAmount * 0.7);
      return sum;
    }, 0);

  const totalIncome = recurringRevenue + pendingIncome;
  // monthlyNetBurn > 0 means burning, netFlow = income - expenses
  const netFlow = -monthlyNetBurn; // positive = surplus
  const nextMonthCapital = state.capital + netFlow;

  const runwayClass =
    runway === Infinity ? 'positive' :
    runway < 4 ? 'danger' :
    runway < 12 ? 'warning' : '';

  const nextMonthClass = nextMonthCapital < 500 ? 'danger' : nextMonthCapital < 1000 ? 'warning' : '';

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

      {/* 지출 내역 */}
      <div className="fin-section">
        <div className="fin-section-label">지출 내역</div>
        <div className="stat-row sub">
          <span>인건비 (월)</span>
          <span className="stat-value danger">-{salaries.toLocaleString()}만원</span>
        </div>
        <div className="stat-row sub">
          <span>운영비 (월)</span>
          <span className="stat-value danger">-{operating.toLocaleString()}만원</span>
        </div>
        <div className="fin-section-total">
          <span>총 지출</span>
          <span className="stat-value danger">-{monthlyBurn.toLocaleString()}만원</span>
        </div>
      </div>

      <div className="divider" />

      {/* 수입 내역 */}
      <div className="fin-section">
        <div className="fin-section-label">수입 내역</div>
        {recurringRevenue > 0 && (
          <div className="stat-row sub">
            <span>월 반복 수입</span>
            <span className="stat-value positive">+{recurringRevenue.toLocaleString()}만원</span>
          </div>
        )}
        {pendingIncome > 0 && (
          <div className="stat-row sub">
            <span>납기 임박 예상</span>
            <span className="stat-value positive">+{pendingIncome.toLocaleString()}만원</span>
          </div>
        )}
        {totalIncome === 0 && (
          <div className="stat-row sub muted">
            <span>수입 없음</span>
            <span className="stat-value">0만원</span>
          </div>
        )}
        <div className="fin-section-total">
          <span>총 수입</span>
          <span className={`stat-value ${totalIncome > 0 ? 'positive' : 'muted'}`}>
            {totalIncome > 0 ? `+${totalIncome.toLocaleString()}` : totalIncome.toLocaleString()}만원
          </span>
        </div>
      </div>

      <div className="divider" />

      {/* 월 결산 */}
      <div className="fin-section">
        <div className="fin-section-label">월 결산</div>
        <div className="fin-net-row">
          <span>총 수입 - 총 지출</span>
          <span className={`stat-value ${netFlow >= 0 ? 'positive' : 'danger'}`}>
            {netFlow >= 0
              ? `+${netFlow.toLocaleString()}만원`
              : `-${Math.abs(netFlow).toLocaleString()}만원`}
          </span>
        </div>
      </div>

      <div className="divider" />

      {/* 다음달 예상 잔액 */}
      <div className="fin-forecast-row">
        <span>다음달 예상 잔액</span>
        <span className={`stat-value ${nextMonthClass}`}>
          {nextMonthCapital.toLocaleString()}만원
        </span>
      </div>

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
