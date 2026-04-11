import { useGameStore } from '../../store/gameStore';
import type { EndingGrade } from '../../types/core';

const GRADE_INFO: Record<EndingGrade, { title: string; subtitle: string; description: string; colorClass: string }> = {
  F: {
    title: 'F — 파산',
    subtitle: '자본이 바닥났습니다',
    description: '런웨이를 지키지 못하고 회사가 문을 닫았습니다. 다음엔 현금 흐름을 더 꼼꼼히 관리해보세요.',
    colorClass: 'danger',
  },
  C: {
    title: 'C — 생존',
    subtitle: '50턴을 버텨냈습니다',
    description: '위기 없이 50턴을 살아남았습니다. 평범하지만 꾸준한 생존자. 더 공격적인 전략을 써보는 건 어떨까요?',
    colorClass: 'neutral',
  },
  B: {
    title: 'B — 외주 강자',
    subtitle: '외주로 20턴 연속 흑자 달성',
    description: '외주 프로젝트로 꾸준한 수익을 냈습니다. 신뢰받는 외주 파트너로 자리잡았습니다.',
    colorClass: 'positive',
  },
};

export function EndingScreen() {
  const state = useGameStore((s) => s.state);

  if (!state || state.gameStatus !== 'ended' || !state.endingGrade) return null;

  const info = GRADE_INFO[state.endingGrade];

  const handleNewGame = () => {
    window.location.reload();
  };

  return (
    <div className="ending-screen">
      <div className="ending-container">
        <div className={`ending-grade ${info.colorClass}`}>{info.title}</div>
        <h2 className="ending-subtitle">{info.subtitle}</h2>
        <p className="ending-description">{info.description}</p>

        <div className="ending-stats">
          <div className="ending-stat">
            <span>최종 턴</span>
            <span>{state.turn}</span>
          </div>
          <div className="ending-stat">
            <span>최종 자본</span>
            <span>{state.capital.toLocaleString()}만원</span>
          </div>
          <div className="ending-stat">
            <span>최종 인원</span>
            <span>{state.employees.length}명</span>
          </div>
          <div className="ending-stat">
            <span>완료 프로젝트</span>
            <span>{state.completedProjectCount}개</span>
          </div>
          <div className="ending-stat">
            <span>팀 케미</span>
            <span>{state.teamChemistry}</span>
          </div>
        </div>

        <div className="ending-actions">
          <button className="restart-btn" onClick={handleNewGame}>
            다시 시작
          </button>
        </div>
      </div>
    </div>
  );
}
