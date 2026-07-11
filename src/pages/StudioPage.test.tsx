import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { StudioAuthProvider } from "../auth/StudioAuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { StudioPage } from "./StudioPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("does not flash the authorized Studio shell while Runtime/Auth is unresolved", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
  render(
    <ThemeProvider>
      <StudioAuthProvider>
        <MemoryRouter
          initialEntries={["/studio"]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <StudioPage />
        </MemoryRouter>
      </StudioAuthProvider>
    </ThemeProvider>,
  );
  expect(screen.getByText("Confirming Studio access.")).toBeInTheDocument();
  expect(screen.queryByText("Your stage will appear here")).not.toBeInTheDocument();
});
