type PublicStudioConfig = Readonly<{
  runtimeApiBaseUrl: string;
  runtimeVersionUrl: string | null;
}>;

function readOptionalPublicUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const publicStudioConfig: PublicStudioConfig = Object.freeze({
  runtimeApiBaseUrl:
    readOptionalPublicUrl(import.meta.env.VITE_RUNTIME_API_BASE_URL) ??
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:18087"
      : "https://api.streamsuites.app"),
  runtimeVersionUrl: readOptionalPublicUrl(import.meta.env.VITE_RUNTIME_VERSION_URL),
});
