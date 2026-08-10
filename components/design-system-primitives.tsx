"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import Link from "next/link";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
export type ActionTone =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dark";

type ActionButtonBaseProps = {
  children: ReactNode;
  variant?: ActionTone;
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
};

type ActionButtonProps =
  | (ActionButtonBaseProps &
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ActionButtonBaseProps | "type" | "href"> & {
        href?: undefined;
      })
  | (ActionButtonBaseProps &
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ActionButtonBaseProps | "href"> & {
        href: string;
      });

type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
  current?: boolean;
};

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
export function ActionButton({
  children,
  variant = "primary",
  size = "md",
  href,
  className = "",
  type = "button",
  disabled = false,
  loading = false,
  ...rest
}: ActionButtonProps) {
  const toneClass = `variant-${variant}`;
  const sizeClass = size === "md" ? "" : `size-${size}`;
  const baseClass = ["ds-button", toneClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");
  const isDisabled = Boolean(disabled || loading);
  const content = children;

  if (href) {
    const { onClick, tabIndex, ...linkProps } = rest as Omit<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      "href"
    >;
    const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    return (
      <Link
        href={href}
        className={baseClass}
        aria-disabled={isDisabled ? true : undefined}
        aria-busy={loading || undefined}
        tabIndex={isDisabled ? -1 : tabIndex}
        onClick={handleLinkClick}
        {...linkProps}
      >
        {content}
      </Link>
    );
  }

  const { onClick, ...buttonProps } = rest as Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type"
  >;

  return (
    <button
      type={type}
      className={baseClass}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {content}
    </button>
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

export function Breadcrumbs({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav className={`ds-breadcrumbs ${className}`} aria-label="현재 위치">
      <ol>
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1;
          return (
            <li key={index}>
              {item.href && !isCurrent ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header ds-section-header">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="ds-section-header-main">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="ds-section-header-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageToolbar({
  children,
  primary,
  secondary,
  className = "",
}: {
  children?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ds-page-toolbar ${className}`}>
      {children ? <div className="ds-page-toolbar-main">{children}</div> : null}
      {secondary ? (
        <div className="ds-page-toolbar-secondary">{secondary}</div>
      ) : null}
      {primary ? <div className="ds-page-toolbar-primary">{primary}</div> : null}
    </div>
  );
}

export function WorkspaceLayout({
  main,
  inspector,
  className = "",
}: {
  main: ReactNode;
  inspector?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ds-workspace-layout ${inspector ? "has-inspector" : ""} ${className}`}
    >
      <div className="ds-workspace-main">{main}</div>
      {inspector ? <div className="ds-workspace-inspector">{inspector}</div> : null}
    </div>
  );
}

export function DrawerSurface({
  title,
  description,
  children,
  footer,
  open = false,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`ds-drawer-surface ${open ? "is-open" : ""} ${className}`}
      aria-hidden={!open}
      aria-label={typeof title === "string" ? title : "상세 패널"}
    >
      <header className="ds-drawer-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="ds-drawer-body">{children}</div>
      {footer ? <footer className="ds-drawer-footer">{footer}</footer> : null}
    </aside>
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

export function InspectorSection({
  title,
  description,
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ds-inspector-section ${className}`}>
      <header className="ds-inspector-section-header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      {children ? <div className="ds-inspector-section-body">{children}</div> : null}
    </section>
  );
}
