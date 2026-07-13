import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROOM_BRANDING, type CustomLayout, type RoomAsset, type StudioGuest } from "../../domain/studio";
import { ParticipantLabelOverlay, MediaParticipantTile } from "../../media/StudioMediaElements";
import { CustomLayoutMenu, CustomLayoutsSection } from "./CustomLayoutControls";
import { RoomBrandingPanel } from "./RoomBrandingPanel";
import { RoomMediaPanel } from "./RoomMediaPanel";
import { stageBrandingStyle } from "../../branding/StageBranding";

const api = vi.hoisted(() => ({ listAssets: vi.fn(), updateBranding: vi.fn(), uploadAsset: vi.fn(), updateAsset: vi.fn(), deleteAsset: vi.fn(), loadBranding: vi.fn() }));
vi.mock("../../api/studioAuth", async (original) => ({ ...(await original<typeof import("../../api/studioAuth")>()), listStudioRoomAssets: api.listAssets, updateStudioBranding: api.updateBranding, uploadStudioRoomAsset: api.uploadAsset, updateStudioRoomAsset: api.updateAsset, deleteStudioRoomAsset: api.deleteAsset, loadStudioBranding: api.loadBranding }));

const layout = (index: number): CustomLayout => ({ id: `layout-${index}`, roomId: "room-1", displayName: `Layout ${index}`, sortOrder: index - 1, baseLayoutMode: index % 2 ? "grid" : "interview", createdAt: "2026-07-14T00:00:00Z", updatedAt: "2026-07-14T00:00:00Z" });
const asset: RoomAsset = { id: "asset-1", roomId: "room-1", category: "logo", displayName: "Show logo", url: "https://cdn.streamsuites.app/studio/rooms/Room1/assets/asset-1/v1.webp", mimeType: "image/webp", width: 320, height: 180, fileSize: 1234, sortOrder: 0, createdAt: "2026-07-14T00:00:00Z", updatedAt: "2026-07-14T00:00:00Z" };

afterEach(() => { cleanup(); vi.restoreAllMocks(); api.listAssets.mockReset(); api.updateBranding.mockReset(); api.uploadAsset.mockReset(); api.updateAsset.mockReset(); api.deleteAsset.mockReset(); api.loadBranding.mockReset(); });

describe("room production foundations", () => {
  it("renders the three participant label modes without touching management identity", () => {
    const { rerender } = render(<><ParticipantLabelOverlay name="Alex" subtitle="Producer" mode="name_and_subtitle" /><strong data-testid="management-name">Alex</strong></>);
    expect(screen.getByText("Producer")).toBeInTheDocument();
    rerender(<><ParticipantLabelOverlay name="Alex" subtitle="Producer" mode="name_only" /><strong data-testid="management-name">Alex</strong></>);
    expect(screen.queryByText("Producer")).not.toBeInTheDocument(); expect(screen.getByTestId("management-name")).toHaveTextContent("Alex");
    rerender(<><ParticipantLabelOverlay name="Alex" subtitle="Producer" mode="hidden" /><strong data-testid="management-name">Alex</strong></>);
    expect(document.querySelector(".participant-label-overlay")).not.toBeInTheDocument(); expect(screen.getByTestId("management-name")).toBeInTheDocument();
  });

  it("keeps a registered remote media element mounted while label visibility and branding change", () => {
    const register = vi.fn(), deregister = vi.fn();
    const participant = { id: "provider-1", videoEnabled: true, audioEnabled: true, videoTrack: { readyState: "live" }, registerVideoElement: register, deregisterVideoElement: deregister };
    const guest = { id: "guest-1", displayName: "Guest", subtitle: "Speaker", avatarUrl: null, avatarColor: "blue" } as StudioGuest;
    const media = { remoteParticipants: new Map([["guest:guest-1", participant]]), activeRuntimeParticipantId: null, state: "connected" } as never;
    const { rerender, unmount } = render(<MediaParticipantTile guest={guest} media={media} labelMode="name_and_subtitle" />);
    expect(register).toHaveBeenCalledTimes(1);
    rerender(<MediaParticipantTile guest={guest} media={media} labelMode="hidden" branding={{ ...DEFAULT_ROOM_BRANDING, nameBadge: { ...DEFAULT_ROOM_BRANDING.nameBadge, position: "lower-right" } }} />);
    expect(register).toHaveBeenCalledTimes(1); expect(deregister).not.toHaveBeenCalled();
    unmount(); expect(deregister).toHaveBeenCalledTimes(1);
  });

  it("uses solid, gradient, and CDN image Stage backgrounds without changing screen media", () => {
    expect(stageBrandingStyle(DEFAULT_ROOM_BRANDING)).toMatchObject({ backgroundColor: "#090c11", backgroundImage: "none" });
    expect(stageBrandingStyle({ ...DEFAULT_ROOM_BRANDING, stageBackground: { ...DEFAULT_ROOM_BRANDING.stageBackground, mode: "gradient" } }).backgroundImage).toContain("linear-gradient");
    expect(stageBrandingStyle({ ...DEFAULT_ROOM_BRANDING, stageBackground: { ...DEFAULT_ROOM_BRANDING.stageBackground, mode: "image", imageUrl: asset.url, imageAssetId: asset.id, imageFit: "contain" } })).toMatchObject({ backgroundImage: `url("${asset.url}")`, backgroundSize: "contain" });
  });

  it("portals the exact ordered custom slots, supports keyboard close, and hides Create at eight", async () => {
    const trigger = render(<CustomLayoutMenu layouts={[layout(1), layout(2)]} selectedId="layout-2" disabled={false} busy={false} onCreate={vi.fn()} onSelect={vi.fn()} onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom layouts" }));
    const popup = screen.getByRole("menu", { name: "Saved custom layouts" }); expect(popup.parentElement).toBe(document.body);
    expect(screen.getByRole("menuitemradio", { name: /Layout 1/ }).querySelector(".studio-icon")?.getAttribute("style")).toContain("layoutcustom1.svg");
    expect(screen.getByRole("menuitemradio", { name: /Layout 2/ }).querySelector(".studio-icon")?.getAttribute("style")).toContain("layoutcustom2.svg");
    expect(screen.getByRole("menuitem", { name: /Create new layout/ })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument()); expect(screen.getByRole("button", { name: "Custom layouts" })).toHaveFocus();
    trigger.unmount();
    render(<CustomLayoutMenu layouts={Array.from({ length: 8 }, (_, index) => layout(index + 1))} selectedId={null} disabled={false} busy={false} onCreate={vi.fn()} onSelect={vi.fn()} onManage={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom layouts" })); expect(screen.queryByRole("menuitem", { name: /Create new layout/ })).not.toBeInTheDocument();
  });

  it("renders honest custom layout management with accessible reorder actions", () => {
    render(<CustomLayoutsSection layouts={[layout(1), layout(2)]} selectedId="layout-1" disabled={false} busyId="" onCreate={vi.fn()} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("2 / 8 custom layouts")).toBeInTheDocument(); expect(screen.getByText("Custom geometry editing will be added in a later Studio milestone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Layout 1 earlier" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Move Layout 2 earlier" })).toBeEnabled();
  });

  it("previews branding drafts and replaces them with the canonical Runtime response", async () => {
    api.listAssets.mockResolvedValue([asset]); api.updateBranding.mockResolvedValue({ ...DEFAULT_ROOM_BRANDING, logo: { ...DEFAULT_ROOM_BRANDING.logo, assetId: asset.id, url: asset.url } });
    const preview = vi.fn(), canonical = vi.fn();
    render(<RoomBrandingPanel roomId="room-1" canonical={DEFAULT_ROOM_BRANDING} canEdit refreshKey={0} onPreview={preview} onCanonical={canonical} />);
    await screen.findByRole("option", { name: "Show logo" });
    fireEvent.change(screen.getByLabelText("Image", { selector: "select" }), { target: { value: asset.id } }); expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ logo: expect.objectContaining({ assetId: asset.id }) }));
    fireEvent.click(screen.getByRole("button", { name: "Save branding" })); await waitFor(() => expect(canonical).toHaveBeenCalledWith(expect.objectContaining({ logo: expect.objectContaining({ url: asset.url }) })));
  });

  it("lists CDN-only assets, filters, selects, assigns, uploads, renames, and deletes", async () => {
    api.listAssets.mockResolvedValue([asset]); api.updateBranding.mockResolvedValue({ ...DEFAULT_ROOM_BRANDING, logo: { ...DEFAULT_ROOM_BRANDING.logo, assetId: asset.id, url: asset.url } }); api.uploadAsset.mockResolvedValue({ ...asset, id: "asset-2", displayName: "New logo" }); api.updateAsset.mockResolvedValue({ ...asset, displayName: "Renamed" }); api.deleteAsset.mockResolvedValue({ brandingAssignmentCleared: false });
    vi.spyOn(window, "prompt").mockReturnValue("Renamed"); vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RoomMediaPanel roomId="room-1" branding={DEFAULT_ROOM_BRANDING} canEdit refreshKey={0} onBranding={vi.fn()} onChanged={vi.fn()} />);
    await screen.findByText("Show logo"); const image = document.querySelector<HTMLImageElement>(".room-asset-grid img")!; expect(image).toHaveAttribute("src", asset.url); expect(image.getAttribute("src")).not.toMatch(/^data:/);
    fireEvent.click(screen.getByRole("button", { name: "Assign" })); await waitFor(() => expect(api.updateBranding).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Rename" })); await waitFor(() => expect(api.updateAsset).toHaveBeenCalledWith("room-1", asset.id, { displayName: "Renamed" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" })); await waitFor(() => expect(api.deleteAsset).toHaveBeenCalledWith("room-1", asset.id, false));
    const file = new File(["image"], "new.png", { type: "image/png" }); fireEvent.change(screen.getByLabelText("Upload PNG, JPEG, or WebP"), { target: { files: [file] } }); await waitFor(() => expect(api.uploadAsset).toHaveBeenCalledWith("room-1", file, "logo"));
  });
});
