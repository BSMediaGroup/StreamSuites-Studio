import { Link } from "react-router-dom";
import studioLogoUrl from "../../assets/logos/studiologo.webp";

interface BrandMarkProps {
  readonly compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Link className="brand-mark" to="/" aria-label="StreamSuites Studio home">
      <img src={studioLogoUrl} alt="StreamSuites Studio" width="42" height="42" />
      <span className="brand-copy">
        <strong>StreamSuites</strong>
        {!compact && <span>Studio</span>}
      </span>
    </Link>
  );
}
