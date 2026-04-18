import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../shared/Modal';
import type { LogEntry } from '../../types/event';
import type { LayerTrace } from '../../types/layer';

const LAYER_LABELS: Record<string, string> = {
  deterministic: '결정론적',
  probabilistic: '확률적',
  chain: '연쇄',
};

const TRACE_TITLES: Record<LayerTrace['layer'], string> = {
  deterministic: '결정론적 규칙',
  probabilistic: '확률적 규칙',
};

function LayerImpactDetail({
  trace,
  source,
}: {
  trace?: LayerTrace;
  source?: string;
}) {
  if (!trace) {
    return (
      <div className="layer-impact-empty">
        <strong>기록된 Layer 영향이 없습니다.</strong>
        <p>이 이벤트는 아직 공통 LayerTrace 형식으로 상세 영향이 기록되지 않았습니다.</p>
      </div>
    );
  }

  return (
    <div className="layer-impact-detail">
      <div className="layer-impact-heading">
        <span className={`log-layer-badge ${trace.layer}`}>
          {TRACE_TITLES[trace.layer]}
        </span>
        <strong>{trace.rule}</strong>
      </div>
      <div className="layer-impact-grid">
        <div className="trace-row">
          <span>조건</span>
          <p>{trace.trigger}</p>
        </div>
        {source && (
          <div className="trace-row">
            <span>출처</span>
            <p>{source}</p>
          </div>
        )}
        <div className="trace-row">
          <span>입력</span>
          <ul>
            {trace.inputs.map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
        </div>
        <div className="trace-row">
          <span>영향</span>
          <ul>
            {trace.effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
        {trace.finalValue && (
          <div className="trace-row">
            <span>결과</span>
            <p>{trace.finalValue}</p>
          </div>
        )}
      </div>
      <p className="trace-note">{trace.note}</p>
    </div>
  );
}

function LayerImpactModal({
  log,
  onClose,
}: {
  log: LogEntry | null;
  onClose: () => void;
}) {
  if (!log) return null;

  return (
    <Modal isOpen onClose={onClose} title="Layer 영향 분석" wide>
      <div className="layer-impact-modal">
        <div className={`layer-impact-summary ${log.layer}`}>
          <div className="log-header">
            <div className="log-badge-row">
              <span className={`log-layer-badge ${log.layer}`}>
                {LAYER_LABELS[log.layer]}
              </span>
              {log.layerTrace && <span className="log-trace-badge">Layer</span>}
            </div>
            <span className="log-turn">T{log.turn}</span>
          </div>
          <p>{log.message}</p>
        </div>
        <LayerImpactDetail trace={log.layerTrace} source={log.source} />
      </div>
    </Modal>
  );
}

function logKey(log: LogEntry, index: number): string {
  return log.id ?? `${log.timestamp}-${index}`;
}

export function EventLogPanel() {
  const state = useGameStore((s) => s.state);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
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
            <button
              type="button"
              key={logKey(log, i)}
              className={`log-entry ${log.layer} ${log.layerTrace ? 'has-trace' : ''}`}
              onClick={() => setSelectedLog(log)}
              aria-label={`T${log.turn} ${log.message} Layer 영향 보기`}
            >
              <div className="log-header">
                <div className="log-badge-row">
                  <span className={`log-layer-badge ${log.layer}`}>
                    {LAYER_LABELS[log.layer]}
                  </span>
                  {log.layerTrace && (
                    <span className="log-trace-badge">Layer</span>
                  )}
                </div>
                <span className="log-turn">T{log.turn}</span>
              </div>
              <span className="log-message">{log.message}</span>
            </button>
          ))}
        </div>
      )}
      <LayerImpactModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
