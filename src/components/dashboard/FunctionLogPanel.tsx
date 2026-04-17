import { useGameStore } from '../../store/gameStore';
import type { FunctionExecutionLogEntry } from '../../types/debug';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTurn(entry: FunctionExecutionLogEntry): string {
  if (entry.turn === null || entry.phase === null) return '-';
  return `T${entry.turn} · P${entry.phase}`;
}

export function FunctionLogPanel() {
  const logs = useGameStore((s) => s.functionLogs);
  const clearFunctionLogs = useGameStore((s) => s.clearFunctionLogs);
  const recentLogs = [...logs].reverse().slice(0, 40);

  return (
    <div className="panel function-log-panel">
      <div className="panel-title-row">
        <h3 className="panel-title">함수 실행 로그</h3>
        {logs.length > 0 && (
          <button className="panel-ghost-btn" type="button" onClick={clearFunctionLogs}>
            비우기
          </button>
        )}
      </div>

      {recentLogs.length === 0 ? (
        <p className="empty-text">아직 함수 실행 기록 없음</p>
      ) : (
        <div className="function-log-list">
          {recentLogs.map((log) => (
            <div key={log.id} className="function-log-entry">
              <div className="function-log-header">
                <span className="function-name">{log.functionName}</span>
                <span className="function-time">{formatTime(log.timestamp)}</span>
              </div>
              <div className="function-log-meta">
                <span>{formatTurn(log)}</span>
                {log.detail && <span>{log.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
