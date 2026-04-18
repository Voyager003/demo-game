import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { buildTurnReportSummary } from './turnReport.view-model';

export function TurnReportModal() {
  const state = useGameStore((s) => s.state);
  const prev = useGameStore((s) => s.prevTurnSnapshot);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const { setShowReport } = useUIStore();

  if (!state || state.phase !== 5) return null;

  const summary = buildTurnReportSummary(state, prev);

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
            {summary.capitalDelta !== 0 && (
              <div className="report-row">
                <span>이번 턴 자본 변동</span>
                <span className={summary.capitalDelta >= 0 ? 'positive' : 'danger'}>
                  {summary.capitalDelta >= 0 ? '+' : ''}{summary.capitalDelta.toLocaleString()}만원
                </span>
              </div>
            )}
            <div className="report-row">
              <span>월 예상 지출</span>
              <span>{summary.monthlyBurn.toLocaleString()}만원</span>
            </div>
            {summary.recurringRevenue > 0 && (
              <div className="report-row">
                <span>월 반복 수입</span>
                <span className="positive">+{summary.recurringRevenue.toLocaleString()}만원</span>
              </div>
            )}
            <div className="report-row">
              <span>월 순현금흐름</span>
              <span className={summary.monthlyNetBurn <= 0 ? 'positive' : ''}>
                {summary.monthlyNetBurn <= 0
                  ? `+${Math.abs(summary.monthlyNetBurn).toLocaleString()}만원`
                  : `-${summary.monthlyNetBurn.toLocaleString()}만원`}
              </span>
            </div>
            <div className="report-row">
              <span>런웨이</span>
              <span className={summary.runway < 8 ? 'warning' : ''}>
                {summary.runway === Infinity ? '흑자 운영 중' : `약 ${summary.runway}턴`}
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
                    {p.status === 'operating'
                      ? `주수입원 · 월 ${p.monthlyRevenue.toLocaleString()}만원`
                      : p.status === 'completed'
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
              <span>{summary.employeeCount}명</span>
            </div>
          </div>

          {/* 최근 로그 */}
          {summary.recentLogs.length > 0 && (
            <div className="report-section">
              <h3>이번 턴 로그</h3>
              <div className="report-log">
                {summary.recentLogs.map((log, i) => (
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
