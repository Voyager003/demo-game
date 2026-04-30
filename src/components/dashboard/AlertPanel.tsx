import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import type { PendingEvent } from '../../types/event';

const PRIORITY_ORDER = [
  'capitalCrisis',
  'employeeQuit',
  'employeeBurnout',
  'teamConflict',
  'investmentResult',
  'traitRevealed',
  'probationConversion',
  'salaryNegotiation',
  'deadlineApproaching',
  'generic',
];

function sortByPriority(events: PendingEvent[]): PendingEvent[] {
  return [...events].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.type) - PRIORITY_ORDER.indexOf(b.type),
  );
}

export function AlertPanel() {
  const state = useGameStore((s) => s.state);
  const { openModal } = useUIStore();
  if (!state) return null;

  const sorted = sortByPriority(state.pendingEvents);

  return (
    <div className="panel alert-panel">
      <h3 className="panel-title">알림</h3>
      {sorted.length === 0 ? (
        <p className="empty-text">대기 중인 알림 없음</p>
      ) : (
        <div className="alert-list">
          {sorted.map((evt) => (
            <div
              key={evt.id}
              className={`alert-item ${evt.type === 'capitalCrisis' ? 'critical' : ''}`}
              onClick={() => openModal('event', evt.id)}
            >
              <span className="alert-title">{evt.title}</span>
              {evt.choices.length > 1 && (
                <span className="alert-action">결정 필요 →</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
