import { createContext, useContext } from "react";

export type StudioTheme = "dark" | "light";
export const THEME_STORAGE_KEY = "streamsuites_studio_theme";

export interface ThemeContextValue {
  readonly theme: StudioTheme;
  readonly toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
