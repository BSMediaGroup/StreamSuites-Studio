import { beforeEach, describe, expect, it } from "vitest";
import { defaultPresentationPreferences, loadPresentationPreferences, parsePresentationPreferences, persistPresentationPreferences, STUDIO_PRESENTATION_STORAGE_KEY } from "./presentationPreferences";

describe("Studio presentation preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses safe first-time defaults", () => {
    expect(loadPresentationPreferences()).toEqual(defaultPresentationPreferences);
  });

  it("persists and restores only validated presentation fields", () => {
    persistPresentationPreferences({ sidebar: "expanded", header: "auto-hide", cinematic: "on", noticeDuration: 12000 });
    expect(loadPresentationPreferences()).toEqual({ sidebar: "expanded", header: "auto-hide", cinematic: "on", noticeDuration: 12000 });
    expect(JSON.parse(window.localStorage.getItem(STUDIO_PRESENTATION_STORAGE_KEY)!)).toEqual({ sidebar: "expanded", header: "auto-hide", cinematic: "on", noticeDuration: 12000 });
  });

  it("falls back field-by-field for corrupted or unknown values", () => {
    expect(parsePresentationPreferences("not-json")).toEqual(defaultPresentationPreferences);
    expect(parsePresentationPreferences(JSON.stringify({ sidebar: "wide", header: "slim", cinematic: "maybe", noticeDuration: 7000, room: { id: "must-not-persist" } }))).toEqual({ sidebar: "collapsed", header: "slim", cinematic: "off", noticeDuration: 5000 });
    expect(parsePresentationPreferences(JSON.stringify({ sidebar: "compact", header: "standard", cinematic: "off", noticeDuration: "manual" }))).toEqual({ sidebar: "collapsed", header: "standard", cinematic: "off", noticeDuration: "manual" });
  });
});
