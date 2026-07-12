import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { GlobalLoadingBar } from "../../activity/GlobalLoadingBar";
import { BrandMark } from "../BrandMark";
import { StudioAccountMenu } from "../StudioAccountMenu";
import { AuthAccessBanner } from "../AuthAccessBanner";
import { ThemeToggle } from "../ThemeToggle";
import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";

const futureNavigation = ["Brand", "Media", "Destinations", "Settings"];

interface StudioShellProps {
  readonly children: ReactNode;
}

export function StudioShell({ children }: StudioShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`studio-shell${menuOpen ? " studio-shell--menu-open" : ""}`}>
      <header className="studio-topbar">
        <Button
          className="menu-toggle"
          variant="quiet"
          aria-expanded={menuOpen}
          aria-controls="studio-sidebar"
          aria-label="Toggle Studio navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </Button>
        <BrandMark />
        <div className="studio-topbar__status">
          <ThemeToggle />
          <StatusChip tone="alpha">ALPHA</StatusChip>
          <StudioAccountMenu />
        </div>
      </header>
      <GlobalLoadingBar />
      <AuthAccessBanner />

      <aside id="studio-sidebar" className="studio-sidebar" aria-label="Studio workspace">
        <nav>
          <Link className="studio-nav-link studio-nav-link--active" to="/studio">
            <span aria-hidden="true">◉</span>
            Studio
          </Link>
          {futureNavigation.map((label) => (
            <button key={label} className="studio-nav-link" type="button" disabled>
              <span aria-hidden="true">○</span>
              {label}
              <span className="studio-nav-link__future">Later</span>
            </button>
          ))}
        </nav>
        <div className="studio-sidebar__note">
          <strong>Closed ALPHA</strong>
          <p>Rooms, invitations, and lobby authority are Runtime/Auth-owned. Media is not implemented.</p>
        </div>
      </aside>

      <main id="main-content" className="studio-main">
        {children}
      </main>
    </div>
  );
}
