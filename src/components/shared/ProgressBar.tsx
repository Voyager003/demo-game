
interface Props {
  value: number;    // 0~100
  max?: number;
  color?: 'accent' | 'positive' | 'warning' | 'danger';
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({ value, max = 100, color = 'accent', label, showPercent }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="progress-bar-wrapper">
      {label && <span className="progress-bar-label">{label}</span>}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && <span className="progress-bar-value">{Math.round(pct)}%</span>}
    </div>
  );
}
