import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../shared/Modal';

export function EventModal() {
  const state = useGameStore((s) => s.state);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const { modalType, modalTargetId, closeModal } = useUIStore();

  const isOpen = modalType === 'event';
  const event = isOpen && modalTargetId
    ? state?.pendingEvents.find((e) => e.id === modalTargetId)
    : null;

  if (!event) return null;

  const handleChoice = (index: number) => {
    resolveEvent(event.id, index);
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title={event.title}>
      <div className="event-modal-content">
        <p className="event-description">{event.description}</p>
        <div className="event-choices">
          {event.choices.map((choice, i) => (
            <button
              key={i}
              className="event-choice-btn"
              onClick={() => handleChoice(i)}
            >
              <span className="choice-label">{choice.label}</span>
              <span className="choice-effect muted">{choice.effect}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
