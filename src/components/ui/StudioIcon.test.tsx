import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StudioIcon } from "./StudioIcon";

describe("StudioIcon", () => {
  it("exposes regular and filled SVGs through a currentColor mask without rendering an image", () => {
    const { container } = render(<StudioIcon regular="/regular.svg" filled="/filled.svg" active />);
    const icon = container.querySelector(".studio-icon");
    expect(icon).toHaveClass("is-filled");
    expect(icon).toHaveStyle({ "--studio-icon-regular": 'url("/regular.svg")', "--studio-icon-filled": 'url("/filled.svg")' });
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("keeps theme-specific currentColor and state tokens in the shared stylesheet", () => {
    const styles = readFileSync("src/styles/index.css", "utf8");
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    expect(styles).toContain("background: currentColor");
    expect(styles).toContain(".icon-control:hover .studio-icon");
    expect(tokens).toContain(':root[data-theme="light"]');
    expect(tokens).toContain("--icon-active:");
    expect(tokens).toContain("--icon-disabled:");
  });
});
