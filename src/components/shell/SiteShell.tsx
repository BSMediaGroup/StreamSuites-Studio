import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { BrandMark } from "../BrandMark";
import { StatusChip } from "../ui/StatusChip";

interface SiteShellProps {
  readonly children: ReactNode;
}

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <BrandMark />
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/login">Access</NavLink>
        </nav>
        <StatusChip tone="alpha">ALPHA</StatusChip>
      </header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <span>StreamSuites Studio</span>
        <span aria-hidden="true">•</span>
        <span>Closed access foundation</span>
      </footer>
    </div>
  );
}
