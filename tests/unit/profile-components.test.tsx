import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/i18n/areas/me";
import { ChipInput } from "@/components/profile/SemesterSubjects";
import ProfilePreview from "@/components/profile/ProfilePreview";
import AvatarUploader from "@/components/profile/AvatarUploader";
import Avatar from "@/components/ui/Avatar";

const c = copy.en.profile;
const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockResize = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/en/me/profile" }));
vi.mock("@/lib/me/profile-actions", () => ({ uploadAvatarAction: (...a: unknown[]) => mockUpload(...a), removeAvatarAction: (...a: unknown[]) => mockRemove(...a) }));
vi.mock("@/lib/media/resizeImage", async (orig) => ({ ...(await orig<typeof import("@/lib/media/resizeImage")>()), resizeImage: (...a: unknown[]) => mockResize(...a) }));
vi.mock("@/components/me/Toast", () => ({ useToast: () => vi.fn() }));

function Chips({ initial = [] as string[] }) {
  const [subjects, setSubjects] = useState(initial);
  return <><ChipInput label="Subjects" hint="hint" subjects={subjects} onChange={setSubjects} c={c} /><pre data-testid="out">{JSON.stringify(subjects)}</pre></>;
}
const out = () => JSON.parse(screen.getByTestId("out").textContent ?? "[]") as string[];

describe("ChipInput", () => {
  it("adds on Enter and on comma, trims, and removes the last chip with Backspace on an empty box", async () => {
    const user = userEvent.setup();
    render(<Chips />);
    const box = screen.getByRole("textbox", { name: "Subjects" });
    await user.type(box, "  Databases {Enter}");
    await user.type(box, "Algorithms,");
    expect(out()).toEqual(["Databases", "Algorithms"]);
    await user.type(box, "{Backspace}");
    expect(out()).toEqual(["Databases"]);
  });
  it("ignores duplicates (case-insensitive) with a hint, and refuses empty and over-long names", async () => {
    const user = userEvent.setup();
    render(<Chips initial={["Databases"]} />);
    const box = screen.getByRole("textbox", { name: "Subjects" });
    await user.type(box, "databases{Enter}");
    expect(out()).toEqual(["Databases"]);
    expect(screen.getByRole("status")).toHaveTextContent("already added");
    await user.type(box, "   {Enter}");
    expect(out()).toEqual(["Databases"]);
    await user.click(box);
    await user.paste("x".repeat(81));
    await user.keyboard("{Enter}");
    expect(out()).toEqual(["Databases"]);
    expect(screen.getByRole("status")).toHaveTextContent("80 characters");
  });
  it("stops at 12 subjects and says so", async () => {
    const user = userEvent.setup();
    render(<Chips initial={Array.from({ length: 12 }, (_, i) => `S${i}`)} />);
    await user.type(screen.getByRole("textbox", { name: "Subjects" }), "One more{Enter}");
    expect(out()).toHaveLength(12);
    expect(screen.getByRole("status")).toHaveTextContent("up to 12");
  });
  it("removes a chip with its own labelled button", async () => {
    const user = userEvent.setup();
    render(<Chips initial={["A", "B"]} />);
    await user.click(screen.getByRole("button", { name: "Remove A" }));
    expect(out()).toEqual(["B"]);
  });
});

describe("ProfilePreview", () => {
  const base = { lang: "en" as const, c, name: "Anuujin Bold", avatar: null, gradYear: 2027, badges: 1, academic: { school_id: "num" as const, school_name: "", major_track: "software" as const, program_index: null, major_label: "" } };
  it("shows school and major as tags, the badge count and only the subjects it is given", () => {
    render(<ProfilePreview {...base} visibility="public" subjects={["Databases"]} />);
    expect(screen.getByText("NUM")).toBeInTheDocument();
    expect(screen.getByText("Software engineering")).toBeInTheDocument();
    expect(screen.getByText("1 badge")).toBeInTheDocument();
    expect(screen.getByText("Databases")).toBeInTheDocument();
    expect(screen.getByText(c.previewAnon)).toBeInTheDocument();
  });
  it("explains a private profile and hides the subject block when there are none", () => {
    render(<ProfilePreview {...base} visibility="private" subjects={[]} />);
    expect(screen.getByText(c.previewPrivate)).toBeInTheDocument();
    expect(screen.queryByText(c.previewSubjects)).toBeNull();
  });
});

describe("Avatar", () => {
  it("renders the photo as an img with the given size and alt, or a letter fallback", () => {
    const { container, rerender } = render(<Avatar name="Anuujin Bold" src="/api/avatar/p1?v=abc" size={48} alt="Anuujin's photo" />);
    const img = screen.getByAltText("Anuujin's photo");
    expect(img).toHaveAttribute("src", "/api/avatar/p1?v=abc");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
    rerender(<Avatar name="Anuujin Bold" size={48} />);
    expect(container.textContent).toBe("AB");
  });
});

describe("AvatarUploader", () => {
  const created: string[] = [];
  const revoked: string[] = [];
  beforeEach(() => {
    mockUpload.mockReset(); mockRemove.mockReset(); mockResize.mockReset();
    created.length = 0; revoked.length = 0;
    let n = 0;
    URL.createObjectURL = vi.fn(() => { const u = `blob:test/${++n}`; created.push(u); return u; });
    URL.revokeObjectURL = vi.fn((u: string) => { revoked.push(u); });
  });
  afterEach(() => vi.restoreAllMocks());
  const file = () => new File(["x"], "me.png", { type: "image/png" });

  it("uploads the resized blob, reports the stored path and revokes the preview URL", async () => {
    const user = userEvent.setup();
    mockResize.mockResolvedValue(new Blob(["w"], { type: "image/webp" }));
    mockUpload.mockResolvedValue({ ok: true, data: { avatar_path: "/api/avatar/p1?v=abc" } });
    const onChange = vi.fn();
    render(<AvatarUploader lang="en" name="Anuujin" src={null} onChange={onChange} c={c} />);
    await user.upload(screen.getByTestId("avatar-input"), file());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/api/avatar/p1?v=abc"));
    const body = mockUpload.mock.calls[0][0] as FormData;
    expect((body.get("file") as File).type).toBe("image/webp");
    expect(body.get("lang")).toBe("en");
    expect(created).toHaveLength(1);
    expect(revoked).toEqual(created);
  });
  it("shows the server's message inline when the upload is refused, and keeps the old photo", async () => {
    const user = userEvent.setup();
    mockResize.mockResolvedValue(new Blob(["w"], { type: "image/webp" }));
    mockUpload.mockResolvedValue({ ok: false, error: "invalid", message: c.errInvalid.avatar });
    const onChange = vi.fn();
    render(<AvatarUploader lang="en" name="Anuujin" src="/api/avatar/p1?v=old" onChange={onChange} c={c} />);
    await user.upload(screen.getByTestId("avatar-input"), file());
    expect(await screen.findByRole("alert")).toHaveTextContent(c.errInvalid.avatar);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByAltText(/Profile photo of Anuujin/)).toHaveAttribute("src", "/api/avatar/p1?v=old");
  });
  it("maps a client-side failure (unreadable file) to a sentence and never calls the server", async () => {
    const user = userEvent.setup();
    const { ImageError } = await import("@/lib/media/resizeImage");
    mockResize.mockRejectedValue(new ImageError("unreadable"));
    render(<AvatarUploader lang="en" name="Anuujin" src={null} onChange={vi.fn()} c={c} />);
    await user.upload(screen.getByTestId("avatar-input"), file());
    expect(await screen.findByRole("alert")).toHaveTextContent(c.photoErr.unreadable);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });
  it("allows one upload at a time (a second drop while busy is ignored) and revokes the URL on unmount", async () => {
    const user = userEvent.setup();
    mockResize.mockResolvedValue(new Blob(["w"], { type: "image/webp" }));
    let release: (v: unknown) => void = () => undefined;
    mockUpload.mockReturnValue(new Promise((r) => { release = r; }));
    const { unmount } = render(<AvatarUploader lang="en" name="Anuujin" src={null} onChange={vi.fn()} c={c} />);
    await user.upload(screen.getByTestId("avatar-input"), file());
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /Choose a photo/ })).toBeDisabled();
    const zone = screen.getByRole("group", { name: c.photoTitle });
    const dt = { files: [file()] } as unknown as DataTransfer;
    zone.dispatchEvent(Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer: dt }));
    expect(mockResize).toHaveBeenCalledTimes(1);
    unmount();
    expect(revoked).toEqual(created);
    release({ ok: true, data: { avatar_path: "/api/avatar/p1?v=z" } });
  });
  it("removes the photo and reports null", async () => {
    const user = userEvent.setup();
    mockRemove.mockResolvedValue({ ok: true, data: undefined });
    const onChange = vi.fn();
    render(<AvatarUploader lang="en" name="Anuujin" src="/api/avatar/p1?v=a" onChange={onChange} c={c} />);
    await user.click(screen.getByRole("button", { name: c.photoRemove }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });
});
