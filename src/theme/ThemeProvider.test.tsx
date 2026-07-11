import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "../components/ThemeToggle";
import { ThemeProvider } from "./ThemeProvider";
import { THEME_STORAGE_KEY } from "./themeContext";

describe("Studio theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "dark";
  });

  it("starts dark and persists only the selected UI theme", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Switch to light theme" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByRole("switch", { name: "Switch to dark theme" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
