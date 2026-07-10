import { Link } from "react-router-dom";
import shieldUrl from "../../assets/logos/logoshield.svg";

interface BrandMarkProps {
  readonly compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Link className="brand-mark" to="/" aria-label="StreamSuites Studio home">
      <img src={shieldUrl} alt="" width="34" height="38" />
      <span className="brand-copy">
        <strong>StreamSuites</strong>
        {!compact && <span>Studio</span>}
      </span>
    </Link>
  );
}
