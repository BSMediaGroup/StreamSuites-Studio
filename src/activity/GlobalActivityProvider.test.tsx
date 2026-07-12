import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { GlobalActivityProvider } from "./GlobalActivityProvider";
import { GlobalLoadingBar } from "./GlobalLoadingBar";
import { useGlobalActivity } from "./useGlobalActivity";

function Harness() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  useGlobalActivity(first, "first");
  useGlobalActivity(second, "second");
  return <>
    <GlobalLoadingBar />
    <button onClick={() => setFirst((value) => !value)}>First</button>
    <button onClick={() => setSecond((value) => !value)}>Second</button>
  </>;
}

describe("GlobalActivityProvider", () => {
  it("keeps the loader active until overlapping activity settles", () => {
    render(<GlobalActivityProvider><Harness /></GlobalActivityProvider>);
    const bar = document.querySelector(".global-loading-bar")!;
    expect(bar).toHaveAttribute("data-active-count", "0");
    act(() => screen.getByRole("button", { name: "First" }).click());
    act(() => screen.getByRole("button", { name: "Second" }).click());
    expect(bar).toHaveAttribute("data-active-count", "2");
    act(() => screen.getByRole("button", { name: "First" }).click());
    expect(bar).toHaveAttribute("data-active-count", "1");
    act(() => screen.getByRole("button", { name: "Second" }).click());
    expect(bar).toHaveAttribute("data-active-count", "0");
  });
});
