
type Variant = 'deterministic' | 'probabilistic' | 'chain' | 'positive' | 'warning' | 'danger' | 'neutral';

interface Props {
  label: string;
  variant?: Variant;
}

export function Badge({ label, variant = 'neutral' }: Props) {
  return <span className={`badge badge-${variant}`}>{label}</span>;
}
