import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

export function EmptyState({ eyebrow, title, children, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <span />
      </div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      <div className="empty-state__copy">{children}</div>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
