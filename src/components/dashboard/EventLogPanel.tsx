import { useGameStore } from '../../store/gameStore';

const LAYER_LABELS: Record<string, string> = {
  deterministic: '결정',
  probabilistic: '확률',
  chain: '연쇄',
};

export function EventLogPanel() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const logs = [...state.eventLog].reverse().slice(0, 20);

  return (
    <div className="panel event-log-panel">
      <h3 className="panel-title">이벤트 로그</h3>
      {logs.length === 0 ? (
        <p className="empty-text">아직 이벤트 없음</p>
      ) : (
        <div className="log-list">
          {logs.map((log, i) => (
            <div key={i} className={`log-entry ${log.layer}`}>
              <div className="log-header">
                <span className={`log-layer-badge ${log.layer}`}>
                  {LAYER_LABELS[log.layer]}
                </span>
                <span className="log-turn">T{log.turn}</span>
              </div>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
