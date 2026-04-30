import type { ReactNode } from 'react';

interface HoverInfoProps {
  label: string;
  description: string;
  deterministicImpact: string[];
  children: ReactNode;
}

export function HoverInfo({ label, description, deterministicImpact, children }: HoverInfoProps) {
  return (
    <span className="hover-info">
      <span className="hover-info-trigger">{children}</span>
      <span className="hover-info-card" role="tooltip">
        <strong>{label}</strong>
        <span className="hover-info-description">{description}</span>
        <span className="hover-info-impact-title">결정론 영향</span>
        <ul>
          {deterministicImpact.map((impact) => (
            <li key={impact}>{impact}</li>
          ))}
        </ul>
      </span>
    </span>
  );
}
