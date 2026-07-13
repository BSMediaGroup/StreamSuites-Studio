import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicePreflightDialog, LocalMediaVideo, RemoteMediaVideo, ScreenShareVideo } from "./StudioMediaElements";
import { useStudioMedia } from "./useStudioMedia";
import * as api from "../api/studioAuth";

const initMock = vi.fn();
let sdkMeeting: ReturnType<typeof createMeeting>;

vi.mock("@cloudflare/realtimekit-react", async () => {
  const React = await import("react");
  return {
    useRealtimeKitClient: () => {
      const [client, setClient] = React.useState<ReturnType<typeof createMeeting> | undefined>();
      return [client, async (options: unknown) => { initMock(options); setClient(sdkMeeting); return sdkMeeting; }];
    },
  };
});

vi.mock("../api/studioAuth", async (original) => ({
  ...(await original<typeof import("../api/studioAuth")>()),
  loadStudioMediaStatus: vi.fn(), createStudioMediaSession: vi.fn(), refreshStudioMediaSession: vi.fn(),
  updateOwnStudioMediaIntent: vi.fn(), reportStudioMediaFailure: vi.fn(), leaveStudioMediaSession: vi.fn(),
}));

class Events {
  listeners = new Map<string, Set<(...args: never[]) => void>>();
  on(name: string, fn: (...args: never[]) => void) { const set = this.listeners.get(name) ?? new Set(); set.add(fn); this.listeners.set(name, set); return this; }
  removeListener(name: string, fn: (...args: never[]) => void) { this.listeners.get(name)?.delete(fn); return this; }
  emit(name: string, payload?: unknown) { this.listeners.get(name)?.forEach((fn) => fn(payload as never)); }
}

class ParticipantMap extends Map<string, ReturnType<typeof participant>> {
  events = new Events();
  on = this.events.on.bind(this.events); removeListener = this.events.removeListener.bind(this.events);
}

function participant(id = "remote", customParticipantId = "binding_remote") {
  return Object.assign(new Events(), {
    id, userId: `user_${id}`, customParticipantId, videoEnabled: true, audioEnabled: true, screenShareEnabled: false,
    videoTrack: { readyState: "live" }, audioTrack: { id: `audio_${id}` }, screenShareTracks: {},
    registerVideoElement: vi.fn(), deregisterVideoElement: vi.fn(), disableAudio: vi.fn().mockResolvedValue(undefined),
    disableVideo: vi.fn().mockResolvedValue(undefined), kick: vi.fn().mockResolvedValue(undefined),
  });
}

function createMeeting() {
  const joined = new ParticipantMap();
  const self = Object.assign(new Events(), {
    id: "self", roomJoined: false, audioEnabled: false, videoEnabled: false, screenShareEnabled: false,
    audioTrack: { id: "local-audio" }, videoTrack: { readyState: "live" }, screenShareTracks: {} as { video?: MediaStreamTrack },
    getAllDevices: vi.fn().mockResolvedValue([
      { kind: "videoinput", deviceId: "camera-1", label: "Camera" },
      { kind: "audioinput", deviceId: "microphone-1", label: "Microphone" },
      { kind: "audiooutput", deviceId: "speaker-1", label: "Speaker" },
    ]),
    getCurrentDevices: vi.fn().mockReturnValue({ video: {}, audio: {}, speaker: {} }), setDevice: vi.fn().mockResolvedValue(undefined),
    enableAudio: vi.fn(async () => { self.audioEnabled = true; self.emit("audioUpdate", {}); }), disableAudio: vi.fn(async () => { self.audioEnabled = false; self.emit("audioUpdate", {}); }),
    enableVideo: vi.fn(async () => { self.videoEnabled = true; self.emit("videoUpdate", {}); }), disableVideo: vi.fn(async () => { self.videoEnabled = false; self.emit("videoUpdate", {}); }),
    enableScreenShare: vi.fn(async () => { self.screenShareEnabled = true; self.screenShareTracks.video = { id: "share" } as MediaStreamTrack; self.emit("screenShareUpdate", { screenShareEnabled: true }); }),
    disableScreenShare: vi.fn(async () => { self.screenShareEnabled = false; self.emit("screenShareUpdate", { screenShareEnabled: false }); }),
    registerVideoElement: vi.fn(), deregisterVideoElement: vi.fn(),
  });
  const participants = Object.assign(new Events(), { joined });
  return {
    self, participants, meta: new Events(), stage: Object.assign(new Events(), { status: "OFF_STAGE", join: vi.fn().mockResolvedValue(undefined), leave: vi.fn().mockResolvedValue(undefined), grantAccess: vi.fn().mockResolvedValue(undefined), kick: vi.fn().mockResolvedValue(undefined) }),
    audio: { addParticipantTrack: vi.fn(), removeParticipantTrack: vi.fn(), play: vi.fn().mockResolvedValue(undefined), setSpeakerDevice: vi.fn() },
    join: vi.fn().mockResolvedValue(undefined), leave: vi.fn().mockResolvedValue(undefined),
  };
}

function Harness({ location = "on_stage" as const }) {
  const media = useStudioMedia("room_123", { location, canScreenShare: true });
  return <><span data-testid="state">{media.state}</span><span data-testid="active">{media.activeRuntimeParticipantId ?? "none"}</span><span data-testid="audio-blocked">{String(media.audioBlocked)}</span><button onClick={() => void media.openPreflight()}>Connect</button><button onClick={() => void media.toggleAudio()}>Toggle audio</button><button onClick={() => void media.toggleScreen()}>Toggle screen</button><button onClick={() => void media.enableAudio()}>Enable audio</button>{media.meeting && <LocalMediaVideo media={media} />}<DevicePreflightDialog media={media} /></>;
}

beforeEach(() => {
  sdkMeeting = createMeeting(); initMock.mockReset();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
  Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: class { constructor(readonly tracks: MediaStreamTrack[]) {} } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.mocked(api.loadStudioMediaStatus).mockResolvedValue({ provider: "cloudflare_realtimekit", enabled: true, configured: true, meetingProvisioned: false, participantMapped: false, reasonCode: "ready", reconciliationRequired: false, reconciliationReason: null, participantBindings: [] });
  vi.mocked(api.createStudioMediaSession).mockResolvedValue({ provider: "cloudflare_realtimekit", authToken: "memory-only", runtimeParticipantId: "guest:self", participantBindings: [], runtime: {} });
  vi.mocked(api.updateOwnStudioMediaIntent).mockResolvedValue(); vi.mocked(api.leaveStudioMediaSession).mockResolvedValue(); vi.mocked(api.reportStudioMediaFailure).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("RealtimeKit Studio media lifecycle", () => {
  it("does not request devices before explicit preflight and initializes once under Strict Mode", async () => {
    render(<StrictMode><Harness /></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("idle"));
    expect(sdkMeeting.self.getAllDevices).not.toHaveBeenCalled(); expect(api.createStudioMediaSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Connect"));
    await screen.findByRole("dialog", { name: "Device preflight" });
    await waitFor(() => expect(sdkMeeting.self.getAllDevices).toHaveBeenCalledTimes(1));
    expect(api.createStudioMediaSession).toHaveBeenCalledTimes(1); expect(initMock).toHaveBeenCalledTimes(1);
  });

  it("joins once, commits actual device state after SDK success, and remains OFF AIR UI-neutral", async () => {
    render(<Harness />); fireEvent.click(screen.getByText("Connect"));
    const join = await screen.findByText("Join room"); fireEvent.click(join);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("connected"));
    expect(sdkMeeting.join).toHaveBeenCalledTimes(1); expect(sdkMeeting.stage.join).toHaveBeenCalledTimes(1);
    expect(api.updateOwnStudioMediaIntent).toHaveBeenCalledWith("room_123", { microphoneMuted: false, cameraHidden: false, screenSharing: false });
  });

  it("registers and deregisters local and remote video without provider IDs in the DOM", () => {
    const remote = participant();
    const localMedia = { meeting: sdkMeeting } as unknown as ReturnType<typeof useStudioMedia>;
    const view = render(<><LocalMediaVideo media={localMedia} /><RemoteMediaVideo participant={remote as never} label="Guest" /></>);
    expect(sdkMeeting.self.registerVideoElement).toHaveBeenCalledTimes(1); expect(remote.registerVideoElement).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).not.toContain("binding_remote"); view.unmount();
    expect(sdkMeeting.self.deregisterVideoElement).toHaveBeenCalledTimes(1); expect(remote.deregisterVideoElement).toHaveBeenCalledTimes(1);
  });

  it("updates Runtime intent only after an SDK microphone change succeeds", async () => {
    render(<Harness />); fireEvent.click(screen.getByText("Connect")); fireEvent.click(await screen.findByText("Join room"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("connected")); vi.mocked(api.updateOwnStudioMediaIntent).mockClear();
    fireEvent.click(screen.getByText("Toggle audio"));
    await waitFor(() => expect(api.updateOwnStudioMediaIntent).toHaveBeenCalledWith("room_123", { microphoneMuted: true }));
    expect(sdkMeeting.self.disableAudio).toHaveBeenCalled();
  });

  it("renders the real screen-share track as a contain presentation video", () => {
    const track = { id: "screen-track" } as MediaStreamTrack;
    const { unmount } = render(<ScreenShareVideo track={track} />);
    expect(screen.getByLabelText("Shared screen")).toHaveClass("presentation-video"); unmount();
  });

  it("plays mapped remote audio, exposes autoplay recovery, active speaker, and reconnect state", async () => {
    vi.mocked(api.createStudioMediaSession).mockResolvedValue({ provider: "cloudflare_realtimekit", authToken: "memory-only", runtimeParticipantId: "guest:self", participantBindings: [{ runtimeParticipantId: "guest:remote", customParticipantId: "binding_remote" }], runtime: {} });
    render(<Harness />); fireEvent.click(screen.getByText("Connect")); fireEvent.click(await screen.findByText("Join room"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("connected"));
    const remote = participant(); sdkMeeting.participants.joined.set(remote.id, remote);
    act(() => { sdkMeeting.participants.joined.events.emit("participantJoined", remote); sdkMeeting.participants.emit("activeSpeaker", { peerId: remote.id, volume: 42 }); });
    await waitFor(() => expect(sdkMeeting.audio.addParticipantTrack).toHaveBeenCalledWith("remote", remote.audioTrack));
    expect(screen.getByTestId("active")).toHaveTextContent("guest:remote");
    act(() => sdkMeeting.self.emit("autoplayError", new Error("blocked")));
    expect(screen.getByTestId("audio-blocked")).toHaveTextContent("true"); fireEvent.click(screen.getByText("Enable audio"));
    await waitFor(() => expect(screen.getByTestId("audio-blocked")).toHaveTextContent("false"));
    act(() => sdkMeeting.meta.emit("socketConnectionUpdate", { state: "reconnecting", reconnected: false, reconnectionAttempt: 1 }));
    expect(screen.getByTestId("state")).toHaveTextContent("reconnecting");
  });

  it("refreshes an expired token sequentially and cleans up the active meeting once", async () => {
    vi.mocked(api.refreshStudioMediaSession).mockResolvedValue("refreshed-memory-only");
    const view = render(<Harness />); fireEvent.click(screen.getByText("Connect")); fireEvent.click(await screen.findByText("Join room"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("connected"));
    const firstOptions = initMock.mock.calls[0][0] as { onError: (error: { code: string }) => void };
    act(() => firstOptions.onError({ code: "0004" }));
    await waitFor(() => expect(api.refreshStudioMediaSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(initMock).toHaveBeenCalledTimes(2));
    expect(sdkMeeting.leave).toHaveBeenCalledTimes(1);
    sdkMeeting.leave.mockClear(); view.unmount();
    await waitFor(() => expect(sdkMeeting.leave).toHaveBeenCalledTimes(1));
  });
});
