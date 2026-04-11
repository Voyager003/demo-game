import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { canPerformAction } from '../../engine/fatigue';
import { ACTION_COSTS } from '../../constants/actionCosts';
import type { ActionType } from '../../types/core';

interface ActionButtonProps {
  action: ActionType;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ action, label, description, onClick, disabled }: ActionButtonProps) {
  const cost = ACTION_COSTS[action];

  return (
    <button
      className={`action-btn ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={description}
    >
      <span className="action-label">{label}</span>
      <span className="action-meta">
        <span className="fatigue-cost">피로 -{cost.fatigue}</span>
        {cost.cooldown > 0 && (
          <span className="cooldown-info">쿨 {cost.cooldown}턴</span>
        )}
      </span>
    </button>
  );
}

export function ActionMenu() {
  const state = useGameStore((s) => s.state);
  const { postJobListing, endTurn } = useGameStore();
  const [section, setSection] = useState<'hr' | 'project' | 'info'>('hr');

  if (!state || state.phase !== 2) return null;

  const can = (action: ActionType) => canPerformAction(state, action);
  const onCooldown = (action: ActionType) => (state.actionCooldowns[action] ?? 0) > 0;
  const cooldownLeft = (action: ActionType) => state.actionCooldowns[action] ?? 0;

  return (
    <div className="action-menu">
      <div className="action-sections">
        <button
          className={`section-tab ${section === 'hr' ? 'active' : ''}`}
          onClick={() => setSection('hr')}
        >
          인사/채용
        </button>
        <button
          className={`section-tab ${section === 'project' ? 'active' : ''}`}
          onClick={() => setSection('project')}
        >
          프로젝트
        </button>
        <button
          className={`section-tab ${section === 'info' ? 'active' : ''}`}
          onClick={() => setSection('info')}
        >
          정보
        </button>
      </div>

      <div className="action-list">
        {section === 'hr' && (
          <>
            <ActionButton
              action="postJobListing"
              label={
                onCooldown('postJobListing')
                  ? `채용 공고 (쿨타임 ${cooldownLeft('postJobListing')}턴)`
                  : '채용 공고 게시'
              }
              description="이력서 풀 3~5개 생성. 쿨타임 2턴."
              onClick={postJobListing}
              disabled={!can('postJobListing')}
            />
            <ActionButton
              action="conductInterview"
              label="면접 및 채용"
              description="이력서에서 직원 채용. 이력서 목록에서 선택."
              onClick={() => {/* 이력서 모달 오픈은 ResumeList에서 */}}
              disabled={!can('conductInterview') || state.pendingResumes.length === 0}
            />
            <ActionButton
              action="fireEmployee"
              label="해고"
              description="직원 해고. 팀 케미 -10. 쿨타임 1턴."
              onClick={() => {/* 직원 선택 모달에서 처리 */}}
              disabled={!can('fireEmployee') || state.employees.length === 0}
            />
            <ActionButton
              action="adjustSalary"
              label={
                onCooldown('adjustSalary')
                  ? `연봉 조정 (쿨타임 ${cooldownLeft('adjustSalary')}턴)`
                  : '연봉 조정'
              }
              description="직원 연봉 조정. 쿨타임 4턴."
              onClick={() => {}}
              disabled={!can('adjustSalary') || state.employees.length === 0}
            />
          </>
        )}

        {section === 'project' && (
          <>
            <ActionButton
              action="signContract"
              label={
                onCooldown('signContract')
                  ? `외주 계약 (쿨타임 ${cooldownLeft('signContract')}턴)`
                  : '외주 계약 체결'
              }
              description="외주 계약 체결. 선금 30% 즉시 수령. 쿨타임 1턴."
              onClick={() => {/* 프로젝트 목록에서 처리 */}}
              disabled={!can('signContract') || state.availableProjects.length === 0}
            />
            <ActionButton
              action="changeAssignment"
              label="업무 배분 변경"
              description="직원-프로젝트 배정 조정."
              onClick={() => {}}
              disabled={!can('changeAssignment') || state.activeProjects.length === 0}
            />
            <ActionButton
              action="orderOvertime"
              label={
                onCooldown('orderOvertime')
                  ? `야근 지시 (쿨타임 ${cooldownLeft('orderOvertime')}턴)`
                  : '야근 지시'
              }
              description="단기 생산성 부스트. 직원 HP 소모. 쿨타임 1턴."
              onClick={() => {}}
              disabled={!can('orderOvertime') || state.activeProjects.length === 0}
            />
          </>
        )}

        {section === 'info' && (
          <div className="info-section">
            <p className="info-text">대시보드 열람, 직원 정보, 이벤트 로그 — 피로도 소모 없음.</p>
          </div>
        )}
      </div>

      <div className="action-footer">
        <button className="end-turn-btn" onClick={endTurn}>
          턴 종료 (Phase 3~5 자동 진행)
        </button>
      </div>
    </div>
  );
}
