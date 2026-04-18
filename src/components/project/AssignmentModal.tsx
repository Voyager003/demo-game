import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { Modal } from '../shared/Modal';
import { canPerformAction, employeeSpecialistTotal, estimateProjectCompletion } from '../../domain';
import { ProjectSlotBar } from '../shared/ProjectSlotBar';
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
  const isOwnedProduct = project.kind === 'ownedProduct';

  // 직원별 이 프로젝트를 제외한 투입 프로젝트 수
  const getOtherProjectCount = (empId: string): number =>
    state.activeProjects.filter(
      (p) =>
        p.id !== projectId &&
        (p.status === 'active' || p.status === 'operating') &&
        p.assignedEmployeeIds.includes(empId),
    ).length;

  // 직원 자신의 maxConcurrentProjects 초과 시 추가 불가 (현재 선택되지 않은 경우에만)
  const isAtCapacity = (emp: { id: string; maxConcurrentProjects: number }): boolean =>
    !selectedIds.includes(emp.id) && getOtherProjectCount(emp.id) >= emp.maxConcurrentProjects;

  const selectedEmployees = state.employees.filter((e) =>
    selectedIds.includes(e.id),
  );

  const estimate = isOwnedProduct
    ? null
    : buildEstimate(project, selectedEmployees, state.turn);

  const toggle = (emp: { id: string; maxConcurrentProjects: number }) => {
    if (isAtCapacity(emp)) return;
    setSelectedIds((prev) =>
      prev.includes(emp.id) ? prev.filter((id) => id !== emp.id) : [...prev, emp.id],
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
        {isOwnedProduct ? (
          <span className="assignment-project-meta">주수입원 · 월 {project.monthlyRevenue.toLocaleString()}만원</span>
        ) : (
          <span className="assignment-project-meta">
            진행도 {project.progress}% · {project.turnsElapsed}/{project.turnsRequired}턴
          </span>
        )}
      </div>

      {!isOwnedProduct && (
        <EstimateCard
          estimate={estimate}
          project={project}
          currentTurn={state.turn}
        />
      )}

      <div className="assignment-employee-list">
        {state.employees.length === 0 && (
          <p className="muted">배정 가능한 직원이 없습니다.</p>
        )}
        {state.employees.map((emp) => {
          const isSelected = selectedIds.includes(emp.id);
          const atCapacity = isAtCapacity(emp);
          const otherCount = getOtherProjectCount(emp.id);
          const max = emp.maxConcurrentProjects;
          const specSum = getSpecSum(emp);
          const cs = emp.commonStats;
          return (
            <button
              key={emp.id}
              className={`assignment-emp-row ${isSelected ? 'selected' : ''} ${atCapacity ? 'at-capacity' : ''}`}
              onClick={() => toggle(emp)}
              disabled={atCapacity}
              title={atCapacity ? `이미 ${otherCount}개 프로젝트에 투입 중 (최대 ${max}개)` : undefined}
            >
              <div className="assignment-emp-left">
                <span className="assignment-emp-name">{emp.name}</span>
                <span className="assignment-emp-role">{ROLE_LABELS[emp.role] ?? emp.role}</span>
                {emp.probationTurnsLeft > 0 && (
                  <span className="assignment-emp-probation">수습</span>
                )}
              </div>
              <div className="assignment-emp-right">
                <div className="assignment-emp-stats-row">
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
                </div>
                <div className="assignment-emp-slot-row">
                  <span className="assignment-emp-slot-label">동시 투입가능 프로젝트</span>
                  <ProjectSlotBar max={max} />
                </div>
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
