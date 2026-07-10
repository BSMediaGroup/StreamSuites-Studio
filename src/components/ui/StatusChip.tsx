import type { ReactNode } from "react";

type StatusTone = "alpha" | "neutral" | "pending" | "blocked";

interface StatusChipProps {
  readonly children: ReactNode;
  readonly tone?: StatusTone;
}

export function StatusChip({ children, tone = "neutral" }: StatusChipProps) {
  return <span className={`status-chip status-chip--${tone}`}>{children}</span>;
}
