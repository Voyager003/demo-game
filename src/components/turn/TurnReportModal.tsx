import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { calcMonthlyBurn, calcRunway } from '../../engine/economyEngine';

export function TurnReportModal() {
  const state = useGameStore((s) => s.state);
  const prev = useGameStore((s) => s.prevTurnSnapshot);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const { setShowReport } = useUIStore();

  if (!state || state.phase !== 5) return null;

  const capitalDelta = prev ? state.capital - prev.capital : 0;
  const monthlyBurn = calcMonthlyBurn(state.employees);
  const runway = calcRunway(state.capital, monthlyBurn);

  const recentLogs = state.eventLog.slice(-8).reverse();

  const handleNextTurn = () => {
    advancePhase(); // Phase5 → Turn+1, Phase1
    setShowReport(false);
  };

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <h2 className="report-title">Turn {state.turn} — 결과 보고</h2>

        <div className="report-sections">
          {/* 자본 변동 */}
          <div className="report-section">
            <h3>경제 현황</h3>
            <div className="report-row">
              <span>자본 잔액</span>
              <span className={state.capital < 500 ? 'danger' : ''}>
                {state.capital.toLocaleString()}만원
              </span>
            </div>
            {capitalDelta !== 0 && (
              <div className="report-row">
                <span>이번 턴 자본 변동</span>
                <span className={capitalDelta >= 0 ? 'positive' : 'danger'}>
                  {capitalDelta >= 0 ? '+' : ''}{capitalDelta.toLocaleString()}만원
                </span>
              </div>
            )}
            <div className="report-row">
              <span>월 예상 지출</span>
              <span>{monthlyBurn.toLocaleString()}만원</span>
            </div>
            <div className="report-row">
              <span>런웨이</span>
              <span className={runway < 8 ? 'warning' : ''}>
                {runway === Infinity ? '흑자 운영 중' : `약 ${runway}턴`}
              </span>
            </div>
          </div>

          {/* 프로젝트 현황 */}
          <div className="report-section">
            <h3>프로젝트</h3>
            {state.activeProjects.length === 0 ? (
              <p className="empty-text">진행 중인 프로젝트 없음</p>
            ) : (
              state.activeProjects.map((p) => (
                <div key={p.id} className="report-row">
                  <span>{p.name}</span>
                  <span>
                    {p.status === 'completed'
                      ? '완료'
                      : `${Math.round(p.progress)}% (${p.turnsElapsed}/${p.turnsRequired}턴)`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* 팀 */}
          <div className="report-section">
            <h3>팀</h3>
            <div className="report-row">
              <span>인원</span>
              <span>{state.employees.length}명</span>
            </div>
            <div className="report-row">
              <span>팀 케미</span>
              <span className={
                state.teamChemistry >= 70 ? 'positive' :
                state.teamChemistry < 30 ? 'danger' : ''
              }>
                {state.teamChemistry}
              </span>
            </div>
          </div>

          {/* 최근 로그 */}
          {recentLogs.length > 0 && (
            <div className="report-section">
              <h3>이번 턴 로그</h3>
              <div className="report-log">
                {recentLogs.map((log, i) => (
                  <div key={i} className={`log-entry ${log.layer}`}>
                    <span className="log-dot" />
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 임박 이벤트 예고 */}
          {state.gameStatus === 'crisis' && (
            <div className="report-section crisis-warning">
              <h3>위기 상태</h3>
              <p>유예 기간: {state.crisisGraceTurnsLeft}턴 남음</p>
              <p>자본을 회복하지 못하면 파산(F등급)으로 게임이 종료됩니다.</p>
            </div>
          )}
        </div>

        <button className="next-turn-btn" onClick={handleNextTurn}>
          다음 턴으로 →
        </button>
      </div>
    </div>
  );
}
