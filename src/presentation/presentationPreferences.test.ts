import { beforeEach, describe, expect, it } from "vitest";
import { defaultPresentationPreferences, loadPresentationPreferences, parsePresentationPreferences, persistPresentationPreferences, STUDIO_PRESENTATION_STORAGE_KEY } from "./presentationPreferences";

describe("Studio presentation preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses safe first-time defaults", () => {
    expect(loadPresentationPreferences()).toEqual(defaultPresentationPreferences);
  });

  it("persists and restores only validated presentation fields", () => {
    persistPresentationPreferences({ sidebar: "compact", header: "auto-hide", cinematic: "on" });
    expect(loadPresentationPreferences()).toEqual({ sidebar: "compact", header: "auto-hide", cinematic: "on" });
    expect(JSON.parse(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY)!)).toEqual({ sidebar: "compact", header: "auto-hide", cinematic: "on" });
  });

  it("falls back field-by-field for corrupted or unknown values", () => {
    expect(parsePresentationPreferences("not-json")).toEqual(defaultPresentationPreferences);
    expect(parsePresentationPreferences(JSON.stringify({ sidebar: "wide", header: "slim", cinematic: "maybe", room: { id: "must-not-persist" } }))).toEqual({ sidebar: "expanded", header: "slim", cinematic: "off" });
  });
});
