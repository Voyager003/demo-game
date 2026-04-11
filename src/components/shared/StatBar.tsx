
interface Props {
  value: number;
  min: number;
  max: number;
  label?: string;
  showValue?: boolean;
}

// -1~5 범위 같은 음수를 포함하는 스탯 바
// 제로 라인 기준으로 음수는 빨간색 왼쪽, 양수는 파란색 오른쪽
export function StatBar({ value, min, max, label, showValue = true }: Props) {
  const range = max - min;
  const zeroRatio = Math.abs(min) / range; // 0의 위치 (0~1)
  const valueRatio = (value - min) / range;

  const isNegative = value < 0;
  const fillLeft = isNegative ? valueRatio : zeroRatio;
  const fillWidth = Math.abs(valueRatio - zeroRatio);

  return (
    <div className="stat-bar-wrapper">
      {label && <span className="stat-bar-label">{label}</span>}
      <div className="stat-bar-track">
        <div
          className={`stat-bar-fill ${isNegative ? 'negative' : 'positive'}`}
          style={{
            left: `${fillLeft * 100}%`,
            width: `${fillWidth * 100}%`,
          }}
        />
        {min < 0 && (
          <div
            className="stat-bar-zero"
            style={{ left: `${zeroRatio * 100}%` }}
          />
        )}
      </div>
      {showValue && (
        <span className={`stat-bar-value ${isNegative ? 'negative' : ''}`}>
          {value}
        </span>
      )}
    </div>
  );
}

// 1~10 범위의 단순 스탯 바
export function SimpleStatBar({ value, max = 10, label }: { value: number; max?: number; label?: string }) {
  return (
    <div className="stat-bar-wrapper">
      {label && <span className="stat-bar-label">{label}</span>}
      <div className="stat-bar-track">
        <div
          className="stat-bar-fill positive"
          style={{ left: 0, width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="stat-bar-value">{value}</span>
    </div>
  );
}
