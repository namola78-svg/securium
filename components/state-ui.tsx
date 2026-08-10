"use client";
import { ActionButton } from "@/components/design-system-primitives";

type StateAction = {
  href?: string;
  label: string;
  onClick?: () => void;
};

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: StateAction;
  secondaryAction?: StateAction;
};

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

const DEFAULT_LOADING_MESSAGE =
  "\uD559\uC2B5 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4";
const DEFAULT_EMPTY_TITLE =
  "\uC544\uC9C1 \uB4F1\uB85D\uD55C \uACFC\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
const DEFAULT_EMPTY_DESCRIPTION =
  "\uAD00\uC2EC \uC788\uB294 \uACFC\uC815\uC744 \uCC3E\uC544 \uD559\uC2B5\uC744 \uC2DC\uC791\uD574\uBCF4\uC138\uC694";
const DEFAULT_ERROR_TITLE =
  "\uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4";
const DEFAULT_ERROR_DESCRIPTION =
  "\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694";
const DEFAULT_RETRY_LABEL = "\uB2E4\uC2DC \uC2DC\uB3C4";

export function PageLoading({
  message = DEFAULT_LOADING_MESSAGE,
}: {
  message?: string;
}) {
  return (
    <main className="page-main route-loading-page">
      <div className="shell">
        <div className="state-card state-loading" role="status" aria-live="polite">
          <span className="state-icon" aria-hidden="true" />
          <strong>{message}</strong>
          <div className="state-skeleton-stack" aria-hidden="true">
            <CardSkeleton />
            <CardSkeleton compact />
          </div>
        </div>
      </div>
    </main>
  );
}

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`card-skeleton ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

export function EmptyState({
  title = DEFAULT_EMPTY_TITLE,
  description = DEFAULT_EMPTY_DESCRIPTION,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="state-card empty-state" role="status" aria-live="polite">
      <span className="state-icon" aria-hidden="true">
        *
      </span>
      <strong role="heading" aria-level={2}>{title}</strong>
      <p>{description}</p>
      <StateActions action={action} secondaryAction={secondaryAction} />
    </div>
  );
}

export function ErrorState({
  title = DEFAULT_ERROR_TITLE,
  description = DEFAULT_ERROR_DESCRIPTION,
  retryLabel = DEFAULT_RETRY_LABEL,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="state-card error-state-panel" role="alert">
      <span className="state-icon" aria-hidden="true">
        !
      </span>
      <strong role="heading" aria-level={2}>{title}</strong>
      <p>{description}</p>
      {onRetry ? <RetryButton label={retryLabel} onRetry={onRetry} /> : null}
    </div>
  );
}

export function InlineError({
  message = `${DEFAULT_ERROR_TITLE}. ${DEFAULT_ERROR_DESCRIPTION}.`,
}: {
  message?: string;
}) {
  return (
    <p className="inline-error" role="alert">
      {message}
    </p>
  );
}

export function RetryButton({
  label = DEFAULT_RETRY_LABEL,
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  return (
    <ActionButton
      variant="secondary"
      type="button"
      onClick={() => {
        if (onRetry) {
          onRetry();
          return;
        }
        window.location.reload();
      }}
    >
      {label}
    </ActionButton>
  );
}

function StateActions({
  action,
  secondaryAction,
}: {
  action?: StateAction;
  secondaryAction?: StateAction;
}) {
  if (!action && !secondaryAction) return null;
  return (
    <div className="state-actions">
      {action ? <StateActionLink action={action} primary /> : null}
      {secondaryAction ? <StateActionLink action={secondaryAction} /> : null}
    </div>
  );
}

function StateActionLink({
  action,
  primary = false,
}: {
  action: StateAction;
  primary?: boolean;
}) {
  const variant = primary ? "outline" : "ghost";
  if (action.href) {
    return <ActionButton variant={variant} href={action.href}>{action.label}</ActionButton>;
  }
  return (
    <ActionButton variant={variant} type="button" onClick={action.onClick}>
      {action.label}
    </ActionButton>
  );
}
