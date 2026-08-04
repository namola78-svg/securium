import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

export function StatusBadge({
  children,
  compact = false,
  tone = "neutral",
}: {
  children: ReactNode;
  compact?: boolean;
  tone?: Tone;
}) {
  return (
    <span className={`status-badge tone-${tone} ${compact ? "compact" : ""}`}>
      {children}
    </span>
  );
}

export function EnvironmentBadge() {
  const label = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "local";
  const normalized = label.toLowerCase();
  const tone: Tone =
    normalized === "production"
      ? "success"
      : normalized === "preview"
        ? "info"
        : "warning";

  return (
    <StatusBadge compact tone={tone}>
      {normalized.toUpperCase()}
    </StatusBadge>
  );
}

export function MetricCard({
  label,
  value,
  description,
}: {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="stat-card ds-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {description ? <small>{description}</small> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`admin-panel ds-panel ${className}`}>{children}</section>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="admin-page-header ds-section-header">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function InspectorPanel({
  eyebrow,
  title,
  description,
  badges = [],
  meta = [],
  actions,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  badges?: Array<{ label: ReactNode; tone?: Tone }>;
  meta?: Array<{ label: ReactNode; value: ReactNode }>;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={`ds-inspector-panel ${className}`} aria-label="선택 항목 상세 정보">
      <header className="ds-inspector-header">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {badges.length ? (
          <div className="ds-inspector-badges" aria-label="상태">
            {badges.map((badge, index) => (
              <StatusBadge compact tone={badge.tone ?? "neutral"} key={index}>
                {badge.label}
              </StatusBadge>
            ))}
          </div>
        ) : null}
      </header>

      {meta.length ? (
        <dl className="ds-inspector-meta">
          {meta.map((item, index) => (
            <div key={index}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="ds-inspector-body">{children}</div> : null}

      {actions ? <div className="ds-inspector-actions">{actions}</div> : null}
    </aside>
  );
}
