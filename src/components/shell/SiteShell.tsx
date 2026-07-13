import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { GlobalLoadingBar } from "../../activity/GlobalLoadingBar";
import { AuthAccessBanner } from "../AuthAccessBanner";
import { BrandMark } from "../BrandMark";
import { ThemeToggle } from "../ThemeToggle";
import { StatusChip } from "../ui/StatusChip";
import { StudioFooter } from "../StudioFooter";
import { TooltipPortal } from "../ui/TooltipPortal";

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
        <div className="site-header__actions">
          <ThemeToggle />
          <StatusChip tone="alpha">ALPHA</StatusChip>
        </div>
      </header>
      <GlobalLoadingBar />
      <AuthAccessBanner />
      <main id="main-content">{children}</main>
      <StudioFooter />
      <TooltipPortal />
    </div>
  );
}
