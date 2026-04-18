import { ProgressBar } from '../shared/ProgressBar';
import type { Project } from '../../types/project';

const LEVEL_LABELS: Record<number, string> = { 1: 'Lv.1', 2: 'Lv.2' };

interface Props {
  project: Project;
  onSign?: (id: string) => void;
  onAssign?: (id: string) => void;
}

export function ProjectCard({ project, onSign, onAssign }: Props) {
  const advance = Math.round(project.totalAmount * 0.3);
  const final = Math.round(project.totalAmount * 0.7);
  const turnsLeft = project.turnsRequired - project.turnsElapsed;
  const isOwnedProduct = project.kind === 'ownedProduct';

  const statusLabel =
    project.status === 'available' ? '계약 가능' :
    project.status === 'active' ? '진행 중' :
    project.status === 'operating' ? '주수입원' :
    project.status === 'completed' ? '완료' : '실패';

  const statusClass =
    project.status === 'active' ? 'active' :
    project.status === 'operating' ? 'operating' :
    project.status === 'completed' ? 'completed' :
    project.status === 'failed' ? 'failed' : '';

  return (
    <div className={`project-card ${statusClass}`}>
      <div className="project-header">
        <span className="project-name">{project.name}</span>
        <span className={`project-status ${statusClass}`}>{statusLabel}</span>
        <span className="project-level">
          {isOwnedProduct ? '자체' : LEVEL_LABELS[project.level]}
        </span>
      </div>

      {isOwnedProduct ? (
        <div className="project-money">
          <span>월 반복 수입 {project.monthlyRevenue.toLocaleString()}만원</span>
          <span className="muted">{project.revenueLabel}</span>
        </div>
      ) : (
        <div className="project-money">
          <span>총 {project.totalAmount.toLocaleString()}만원</span>
          <span className="muted">선금 {advance.toLocaleString()} / 잔금 {final.toLocaleString()}</span>
        </div>
      )}

      {project.status === 'operating' && (
        <div className="project-info operating">
          <span>선택 도메인 기반 자체 서비스</span>
          <span>4턴마다 자동 정산</span>
        </div>
      )}

      {project.status === 'available' && (
        <div className="project-info">
          <span>예상 소요: {project.turnsRequired}턴</span>
          {onSign && (
            <button
              className="sign-btn"
              onClick={() => onSign(project.id)}
            >
              계약 체결 (피로 -3)
            </button>
          )}
        </div>
      )}

      {project.status === 'active' && (
        <>
          <ProgressBar
            value={project.progress}
            color={
              turnsLeft <= 2 ? 'warning' :
              project.progress >= 80 ? 'positive' : 'accent'
            }
            showPercent
          />
          <div className="project-info">
            <span>
              {project.turnsElapsed}/{project.turnsRequired}턴 경과
              {turnsLeft > 0 ? ` (잔여 ${turnsLeft}턴)` : ' (마감 초과!)'}
            </span>
            <span>배정 {project.assignedEmployeeIds.length}명</span>
            {onAssign && (
              <button
                className="assign-btn"
                onClick={() => onAssign(project.id)}
              >
                배정 변경
              </button>
            )}
          </div>
        </>
      )}

      {project.status === 'completed' && (
        <div className="project-info completed">
          <span>만족도: {project.clientSatisfaction}%</span>
          <span>
            {project.finalPaid
              ? `잔금 수령 완료`
              : `잔금 대기: ${final.toLocaleString()}만원`}
          </span>
        </div>
      )}
    </div>
  );
}
