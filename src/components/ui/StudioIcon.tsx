import type { CSSProperties } from "react";

interface StudioIconProps {
  readonly regular: string;
  readonly filled?: string;
  readonly active?: boolean;
  readonly className?: string;
}

type IconStyle = CSSProperties & {
  "--studio-icon-regular": string;
  "--studio-icon-filled": string;
};

export function StudioIcon({ regular, filled = regular, active = false, className = "" }: StudioIconProps) {
  const style: IconStyle = {
    "--studio-icon-regular": `url("${regular}")`,
    "--studio-icon-filled": `url("${filled}")`,
  };

  return <span className={`studio-icon${active ? " is-filled" : ""}${className ? ` ${className}` : ""}`} style={style} aria-hidden="true" />;
}
