import { useTheme } from "../theme/themeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <button
      className="theme-toggle"
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={`Switch to ${light ? "dark" : "light"} theme`}
      onClick={toggleTheme}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">{light ? "☀" : "☾"}</span>
      </span>
      <span className="theme-toggle__label">{light ? "Light" : "Dark"}</span>
    </button>
  );
}
