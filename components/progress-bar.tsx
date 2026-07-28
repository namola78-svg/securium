export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{safeValue}%</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
      >
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
