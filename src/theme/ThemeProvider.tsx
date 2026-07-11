import { useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, ThemeContext, type StudioTheme, type ThemeContextValue } from "./themeContext";

function initialTheme(): StudioTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [theme, setTheme] = useState<StudioTheme>(initialTheme);
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => {
        setTheme((current) => {
          const next = current === "dark" ? "light" : "dark";
          document.documentElement.dataset.theme = next;
          document.documentElement.style.colorScheme = next;
          try {
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
          } catch {
            // Theme remains applied for this page when storage is unavailable.
          }
          document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", next === "dark" ? "#080a0f" : "#f4f6f8");
          return next;
        });
      },
    }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
