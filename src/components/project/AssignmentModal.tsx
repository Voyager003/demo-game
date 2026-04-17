import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../shared/Modal';
import { canPerformAction, employeeSpecialistTotal, estimateProjectCompletion } from '../../domain';
import type { Employee } from '../../types/employee';
import type { Project } from '../../types/project';

const ROLE_LABELS: Record<string, string> = {
  developer: '개발자',
  designer: '디자이너',
  pm: 'PM',
};

function getSpecSum(emp: Employee): number {
  return employeeSpecialistTotal(emp);
}

function statValClass(v: number): string {
  if (v >= 1) return 'positive';
  if (v <= -1) return 'danger';
  return 'neutral';
}

interface Estimate {
  progressPerTurn: number;
  turnsLeft: number;
  finishTurn: number;
}

function buildEstimate(
  project: Project,
  selectedEmployees: Employee[],
  currentTurn: number,
): Estimate | null {
  return estimateProjectCompletion(project, selectedEmployees, currentTurn);
}

function EstimateCard({
  estimate,
  project,
  currentTurn,
}: {
  estimate: Estimate | null;
  project: Project;
  currentTurn: number;
}) {
  const deadlineTurn =
    currentTurn + (project.turnsRequired - project.turnsElapsed);

  if (!estimate) {
    return (
      <div className="estimate-card no-dev">
        <span className="estimate-no-dev">배정 인원이 있어야 진척됩니다</span>
      </div>
    );
  }

  const slack = deadlineTurn - estimate.finishTurn;
  const isLate = slack < 0;

  return (
    <div className={`estimate-card ${isLate ? 'late' : ''}`}>
      <div className="estimate-row">
        <span className="estimate-label">예상 진행속도</span>
        <span className="estimate-value">{estimate.progressPerTurn.toFixed(1)}% / 턴</span>
      </div>
      <div className="estimate-row">
        <span className="estimate-label">예상 소요</span>
        <span className="estimate-value">{estimate.turnsLeft}턴 남음</span>
      </div>
      <div className="estimate-row">
        <span className="estimate-label">예상 완료</span>
        <span className="estimate-value">
          Turn {estimate.finishTurn}
          {isLate ? (
            <span className="estimate-warn"> (납기 {Math.abs(slack)}턴 초과!)</span>
          ) : (
            <span className="estimate-ok"> (납기 {slack}턴 여유)</span>
          )}
        </span>
      </div>
    </div>
  );
}

function AssignmentModalContent({ projectId }: { projectId: string }) {
  const state = useGameStore((s) => s.state);
  const setProjectAssignments = useGameStore((s) => s.setProjectAssignments);
  const closeModal = useUIStore((s) => s.closeModal);

  const project = state?.activeProjects.find((p) => p.id === projectId);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project?.assignedEmployeeIds ?? [],
  );

  if (!state || !project) return null;

  const canConfirm = state.phase === 2 && canPerformAction(state, 'changeAssignment');

  const selectedEmployees = state.employees.filter((e) =>
    selectedIds.includes(e.id),
  );

  const estimate = buildEstimate(
    project,
    selectedEmployees,
    state.turn,
  );

  const toggle = (empId: string) => {
    setSelectedIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  };

  const handleConfirm = () => {
    setProjectAssignments(projectId, selectedIds);
    closeModal();
  };

  return (
    <div className="assignment-modal">
      <div className="assignment-project-info">
        <span className="assignment-project-name">{project.name}</span>
        <span className="assignment-project-meta">
          진행도 {project.progress}% · {project.turnsElapsed}/{project.turnsRequired}턴
        </span>
      </div>

      <EstimateCard
        estimate={estimate}
        project={project}
        currentTurn={state.turn}
      />

      <div className="assignment-employee-list">
        {state.employees.length === 0 && (
          <p className="muted">배정 가능한 직원이 없습니다.</p>
        )}
        {state.employees.map((emp) => {
          const isSelected = selectedIds.includes(emp.id);
          const specSum = getSpecSum(emp);
          const cs = emp.commonStats;
          return (
            <button
              key={emp.id}
              className={`assignment-emp-row ${isSelected ? 'selected' : ''}`}
              onClick={() => toggle(emp.id)}
            >
              <div className="assignment-emp-left">
                <span className="assignment-emp-name">{emp.name}</span>
                <span className="assignment-emp-role">{ROLE_LABELS[emp.role] ?? emp.role}</span>
                {emp.probationTurnsLeft > 0 && (
                  <span className="assignment-emp-probation">수습</span>
                )}
              </div>
              <div className="assignment-emp-right">
                <span className="assignment-emp-spec">스탯합 {specSum}</span>
                <span className="emp-common-stats">
                  <span className={`stat-val ${statValClass(cs.stamina)}`}>
                    체력{cs.stamina >= 0 ? '+' : ''}{cs.stamina}
                  </span>
                  <span className={`stat-val ${statValClass(cs.communication)}`}>
                    소통{cs.communication >= 0 ? '+' : ''}{cs.communication}
                  </span>
                  <span className={`stat-val ${statValClass(cs.mental)}`}>
                    멘탈{cs.mental >= 0 ? '+' : ''}{cs.mental}
                  </span>
                </span>
                <span className={`assignment-emp-badge ${isSelected ? 'on' : 'off'}`}>
                  {isSelected ? '배정 ✓' : '미배정'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="assignment-footer">
        <span className="assignment-count">{selectedIds.length}명 선택됨</span>
        <button
          className="assignment-confirm-btn"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          배정 확정 (피로 -1)
        </button>
      </div>
    </div>
  );
}

export function AssignmentModal() {
  const modalType = useUIStore((s) => s.modalType);
  const modalTargetId = useUIStore((s) => s.modalTargetId);
  const closeModal = useUIStore((s) => s.closeModal);

  if (modalType !== 'assignment' || !modalTargetId) return null;

  return (
    <Modal isOpen onClose={closeModal} title="인력 배정">
      <AssignmentModalContent projectId={modalTargetId} />
    </Modal>
  );
}
