import type { CSSProperties } from "react";
import type { RoomBranding } from "../domain/studio";

// Shared by the two stable Stage surfaces; it does not hold component state.
// eslint-disable-next-line react-refresh/only-export-components
export function stageBrandingStyle(branding: RoomBranding): CSSProperties {
  const background = branding.stageBackground;
  if (background.mode === "image" && background.imageUrl) {
    return { backgroundColor: background.color, backgroundImage: `url("${background.imageUrl}")`, backgroundRepeat: "no-repeat", backgroundSize: background.imageFit, backgroundPosition: background.imagePosition };
  }
  if (background.mode === "gradient") {
    return { backgroundColor: background.color, backgroundImage: `linear-gradient(135deg, ${background.color}, ${background.gradientColor})` };
  }
  return { backgroundColor: background.color, backgroundImage: "none" };
}

export function StageBrandingOverlay({ branding }: { readonly branding: RoomBranding }) {
  if (!branding.logo.url) return null;
  return <img className={`stage-brand-logo stage-brand-logo--${branding.logo.position} stage-brand-logo--${branding.logo.size}`} src={branding.logo.url} alt="" aria-hidden="true" style={{ opacity: branding.logo.opacity }} />;
}
