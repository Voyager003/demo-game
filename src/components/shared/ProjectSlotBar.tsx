interface Props {
  max: number;
}

export function ProjectSlotBar({ max }: Props) {
  return (
    <div className="project-slot-bar">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="project-slot" />
      ))}
    </div>
  );
}
