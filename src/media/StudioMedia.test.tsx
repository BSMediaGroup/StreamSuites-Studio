import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevicePreflightDialog, LocalMediaVideo, MediaParticipantTile, RemoteMediaVideo, ScreenShareVideo } from "./StudioMediaElements";
import { useStudioMedia, type StudioRemoteParticipant } from "./useStudioMedia";
import * as api from "../api/studioAuth";

vi.mock("../api/studioAuth", async (original) => ({
  ...(await original<typeof import("../api/studioAuth")>()),
  loadStudioRealtimeStatus: vi.fn(), createStudioRealtimeSession: vi.fn(), publishStudioRealtimeTracks: vi.fn(),
  listStudioRealtimeTracks: vi.fn(), subscribeStudioRealtimeTracks: vi.fn(), renegotiateStudioRealtimeSession: vi.fn(),
  heartbeatStudioRealtimeSession: vi.fn(), leaveStudioRealtimeSession: vi.fn(), updateOwnStudioMediaIntent: vi.fn(),
}));

const camera = { kind: "video", enabled: true, readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;
const microphone = { kind: "audio", enabled: true, readyState: "live", stop: vi.fn() } as unknown as MediaStreamTrack;

class FakeStream {
  constructor(private readonly tracks: MediaStreamTrack[] = [camera, microphone]) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
}

class FakePeerConnection {
  connectionState = "connected";
  signalingState = "stable";
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  private readonly transceivers: Array<{ sender: { track: MediaStreamTrack }; mid: string | null }> = [];
  addTrack(track: MediaStreamTrack) { this.transceivers.push({ sender: { track }, mid: null }); return {} as RTCRtpSender; }
  getTransceivers() { return this.transceivers as unknown as RTCRtpTransceiver[]; }
  async createOffer() { return { type: "offer" as RTCSdpType, sdp: "v=0\r\n" }; }
  async createAnswer() { return { type: "answer" as RTCSdpType, sdp: "v=0\r\n" }; }
  async setLocalDescription(value: RTCSessionDescriptionInit) { this.localDescription = value; this.transceivers.forEach((item, index) => { item.mid = String(index); }); }
  async setRemoteDescription() { return; }
  close() { this.connectionState = "closed"; }
}

function Harness() {
  const media = useStudioMedia("room_123", { location: "on_stage", canScreenShare: true });
  return <><span data-testid="state">{media.state}</span><button onClick={() => void media.openPreflight()}>Connect</button>{media.meeting && <LocalMediaVideo media={media} />}<DevicePreflightDialog media={media} /></>;
}

beforeEach(() => {
  camera.enabled = true; microphone.enabled = true;
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(globalThis, "MediaStream", { configurable: true, value: FakeStream });
  Object.defineProperty(globalThis, "RTCPeerConnection", { configurable: true, value: FakePeerConnection });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "camera-1", label: "Camera" }, { kind: "audioinput", deviceId: "microphone-1", label: "Microphone" }]),
    getUserMedia: vi.fn().mockResolvedValue(new FakeStream()), getDisplayMedia: vi.fn().mockResolvedValue(new FakeStream([camera])),
  } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.mocked(api.loadStudioRealtimeStatus).mockResolvedValue({ enabled: true, configured: true });
  vi.mocked(api.createStudioRealtimeSession).mockResolvedValue({ sessionId: "mapping-1", participantId: "account:owner", generation: 2, stunUrls: ["stun:stun.cloudflare.com:3478"] });
  vi.mocked(api.publishStudioRealtimeTracks).mockResolvedValue({ sessionDescription: { type: "answer", sdp: "v=0\r\n" }, requiresImmediateRenegotiation: false, tracks: [] });
  vi.mocked(api.listStudioRealtimeTracks).mockResolvedValue([]); vi.mocked(api.updateOwnStudioMediaIntent).mockResolvedValue(); vi.mocked(api.leaveStudioRealtimeSession).mockResolvedValue(); vi.mocked(api.heartbeatStudioRealtimeSession).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("direct Cloudflare Realtime SFU media lifecycle", () => {
  it("does not request devices before explicit preflight", async () => {
    render(<Harness />); await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("idle"));
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled(); fireEvent.click(screen.getByText("Connect"));
    await screen.findByRole("dialog", { name: "Device preflight" }); expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("publishes only SDP and track descriptors through Runtime/Auth", async () => {
    render(<Harness />); fireEvent.click(screen.getByText("Connect")); fireEvent.click(await screen.findByText("Join room"));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("connected"));
    expect(api.createStudioRealtimeSession).toHaveBeenCalledWith("room_123");
    expect(api.publishStudioRealtimeTracks).toHaveBeenCalledWith("room_123", "mapping-1", expect.objectContaining({ type: "offer" }), expect.arrayContaining([expect.objectContaining({ source_role: "camera" }), expect.objectContaining({ source_role: "microphone" })]));
    expect(api.updateOwnStudioMediaIntent).toHaveBeenCalledWith("room_123", { microphoneMuted: false, cameraHidden: false, screenSharing: false });
  });

  it("attaches local and remote browser tracks without exposing provider IDs", () => {
    const localMedia = { localStream: new FakeStream(), meeting: { self: { videoTrack: camera, audioTrack: microphone } } } as unknown as ReturnType<typeof useStudioMedia>;
    const participant: StudioRemoteParticipant = { id: "runtime-guest", videoEnabled: true, audioEnabled: true, videoTrack: camera, audioTrack: microphone, screenShareEnabled: false, screenShareTracks: { video: null } };
    const view = render(<><LocalMediaVideo media={localMedia} /><RemoteMediaVideo participant={participant} label="Guest" /></>);
    expect(screen.getByLabelText("Local camera")).toBeInTheDocument(); expect(screen.getByLabelText("Guest camera")).toBeInTheDocument(); expect(view.container.textContent).not.toContain("runtime-guest");
  });

  it("renders screen media and participant fallback truthfully", () => {
    render(<ScreenShareVideo track={camera} />); expect(screen.getByLabelText("Shared screen")).toHaveClass("presentation-video"); cleanup();
    const media = { remoteParticipants: new Map(), activeRuntimeParticipantId: null, state: "connected" } as unknown as ReturnType<typeof useStudioMedia>;
    render(<MediaParticipantTile guest={{ id: "guest-1", displayName: "Daniel", subtitle: "Guest", avatarUrl: null, avatarColor: "blue" } as never} media={media} />);
    expect(screen.getByTestId("participant-fallback")).toHaveTextContent("Provider participant not connected");
  });
});
