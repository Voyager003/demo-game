import { useGameStore } from '../../store/gameStore';

const PHASE_NAMES: Record<number, string> = {
  1: 'Phase 1 — 이벤트',
  2: 'Phase 2 — 의사결정',
  3: 'Phase 3 — 실행',
  4: 'Phase 4 — 정산',
  5: 'Phase 5 — 결과 보고',
};

export function TurnHeader() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const fatiguePct = (state.fatigue.current / state.fatigue.max) * 100;
  const fatigueColor =
    fatiguePct > 50 ? 'positive' : fatiguePct > 25 ? 'warning' : 'danger';

  const crisisMessage =
    state.gameStatus === 'crisis'
      ? `위기! 유예 ${state.crisisGraceTurnsLeft}턴 남음`
      : null;

  return (
    <header className="turn-header">
      <div className="turn-header-left">
        <span className="turn-number">Turn {state.turn}</span>
        <span className="company-name">{state.companyName}</span>
        {crisisMessage && (
          <span className="crisis-badge">{crisisMessage}</span>
        )}
      </div>

      <div className="turn-header-center">
        <span className="phase-label">{PHASE_NAMES[state.phase]}</span>
      </div>

      <div className="turn-header-right">
        <div className="fatigue-display">
          <span className="fatigue-label">피로도</span>
          <div className="fatigue-track">
            <div
              className={`fatigue-fill ${fatigueColor}`}
              style={{ width: `${fatiguePct}%` }}
            />
          </div>
          <span className="fatigue-value">
            {state.fatigue.current}/{state.fatigue.max}
          </span>
        </div>
        <div className="capital-display">
          <span className="capital-label">자본</span>
          <span className={`capital-value ${state.capital < 500 ? 'danger' : ''}`}>
            {state.capital.toLocaleString()}만원
          </span>
        </div>
      </div>
    </header>
  );
}
