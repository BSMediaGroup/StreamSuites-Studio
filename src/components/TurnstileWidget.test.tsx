import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTurnstileConfig } from "../api/studioAuth";
import {
  TurnstileWidget,
  type TurnstileState,
} from "./TurnstileWidget";

vi.mock("../api/studioAuth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/studioAuth")>();
  return { ...original, loadTurnstileConfig: vi.fn() };
});

const loadConfigMock = vi.mocked(loadTurnstileConfig);

afterEach(() => {
  document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach((node) => node.remove());
  delete window.turnstile;
  vi.clearAllMocks();
});

describe("TurnstileWidget", () => {
  it("loads the explicit script once under Strict Mode and reports a retryable provider failure", async () => {
    loadConfigMock.mockResolvedValue({
      enabled: true,
      runtimeEnabled: true,
      configured: true,
      sitekey: "public-site-key",
    });
    render(
      <StrictMode>
        <TurnstileWidget theme="dark" onStateChange={() => undefined} />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(
        document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]'),
      ).not.toBeNull(),
    );
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    );
    expect(document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]')).toHaveLength(1);
    fireEvent.error(script!);
    expect(await screen.findByText("The security provider is unavailable. Retry the check.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry security check" })).toBeEnabled();
  });

  it("renders dark and light widgets without duplicates, expires tokens, and cleans up", async () => {
    loadConfigMock.mockResolvedValue({
      enabled: true,
      runtimeEnabled: true,
      configured: true,
      sitekey: "public-site-key",
    });
    let callback: ((token: string) => void) | undefined;
    let expiredCallback: (() => void) | undefined;
    const renderWidget = vi.fn((_slot: HTMLElement, options: Record<string, unknown>) => {
      callback = options.callback as (token: string) => void;
      expiredCallback = options["expired-callback"] as () => void;
      return renderWidget.mock.calls.length;
    });
    const remove = vi.fn();
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove };
    const states: TurnstileState[] = [];
    const view = render(
      <TurnstileWidget theme="dark" onStateChange={(state) => states.push(state)} />,
    );

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    expect(renderWidget.mock.calls[0][1]).toMatchObject({
      sitekey: "public-site-key",
      theme: "dark",
    });
    act(() => callback?.("ephemeral-token"));
    expect(states.at(-1)).toMatchObject({ phase: "ready", token: "ephemeral-token" });
    act(() => expiredCallback?.());
    expect(states.at(-1)).toMatchObject({ phase: "expired", token: "" });

    view.rerender(
      <TurnstileWidget theme="light" onStateChange={(state) => states.push(state)} />,
    );
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(renderWidget.mock.calls[1][1]).toMatchObject({ theme: "light" });
    expect(remove).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
