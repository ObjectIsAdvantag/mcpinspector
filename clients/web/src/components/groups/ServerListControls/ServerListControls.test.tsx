import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import { ServerListControls } from "./ServerListControls";

const baseProps = {
  compact: false,
  serverCount: 0,
  onToggleList: vi.fn(),
  onAddManually: vi.fn(),
  onImportConfig: vi.fn(),
  onImportServerJson: vi.fn(),
  onExport: vi.fn(),
  onOpenSession: vi.fn(),
  sessionOpenDisabled: false,
};

describe("ServerListControls", () => {
  it("hides the list toggle when there are no servers", () => {
    renderWithMantine(<ServerListControls {...baseProps} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: /Open Session/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Servers/ }),
    ).toBeInTheDocument();
  });

  it("shows the list toggle when servers exist", () => {
    renderWithMantine(<ServerListControls {...baseProps} serverCount={2} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("calls onToggleList when the list toggle is clicked", async () => {
    const user = userEvent.setup();
    const onToggleList = vi.fn();
    renderWithMantine(
      <ServerListControls
        {...baseProps}
        serverCount={1}
        onToggleList={onToggleList}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Expand all|Collapse all/ }),
    );
    expect(onToggleList).toHaveBeenCalledTimes(1);
  });

  it("disables Export when the list is empty (nothing to download)", () => {
    renderWithMantine(<ServerListControls {...baseProps} />);
    expect(screen.getByRole("button", { name: /Export/ })).toBeDisabled();
  });

  it("enables Export when at least one server exists", () => {
    renderWithMantine(<ServerListControls {...baseProps} serverCount={1} />);
    expect(screen.getByRole("button", { name: /Export/ })).not.toBeDisabled();
  });

  it("calls onExport when Export is clicked (with at least one server)", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    renderWithMantine(
      <ServerListControls {...baseProps} serverCount={1} onExport={onExport} />,
    );
    await user.click(screen.getByRole("button", { name: /Export/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("passes a selected JSON artifact to onOpenSession", async () => {
    const user = userEvent.setup();
    const onOpenSession = vi.fn();
    const { container } = renderWithMantine(
      <ServerListControls {...baseProps} onOpenSession={onOpenSession} />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected the session file input");
    }
    const file = new File(["{}"], "session.json", {
      type: "application/json",
    });

    await user.upload(input, file);

    expect(input).toHaveAttribute(
      "accept",
      "application/vnd.modelcontextprotocol.inspector-session+json,application/json,.json",
    );
    expect(onOpenSession).toHaveBeenCalledWith(file);

    await user.upload(input, file);
    expect(onOpenSession).toHaveBeenCalledTimes(2);
  });

  it("disables session selection until the live client disconnects", async () => {
    const user = userEvent.setup();
    const onOpenSession = vi.fn();
    renderWithMantine(
      <ServerListControls
        {...baseProps}
        onOpenSession={onOpenSession}
        sessionOpenDisabled
      />,
    );

    const button = screen.getByRole("button", { name: /Open Session/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onOpenSession).not.toHaveBeenCalled();
  });
});
