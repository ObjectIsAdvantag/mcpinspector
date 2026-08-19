import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { NativeSessionArtifactSchema } from "@inspector/core/extensions/api/sessions.js";
import { createNativeSessionReplayStore } from "@inspector/core/extensions/builtin/inspector-session/replay.js";
import { renderWithMantine, screen } from "../../../test/renderWithMantine";
import mcpLogoDark from "../../../theme/assets/MCP-dark.svg";
import { SessionReplayView } from "./SessionReplayView";

function replayStore(
  toolCount = 1,
  protocolMetadata: "full" | "version-only" | "none" = "full",
) {
  return createNativeSessionReplayStore(
    NativeSessionArtifactSchema.parse({
      header: {
        format: {
          id: "modelcontextprotocol.inspector-session-1",
          version: "1.0.0",
        },
        inspectorVersion: "2.2.0",
        capturedAt: "2026-08-19T10:15:00.000Z",
        sessionId: "session-1",
      },
      server: {
        implementation: { name: "Replay Demo", version: "1.0.0" },
        ...(protocolMetadata !== "none" && {
          protocolVersion: "2025-06-18",
        }),
        ...(protocolMetadata === "full" && {
          protocolEra: "modern",
        }),
      },
      discovery: {
        tools: Array.from({ length: toolCount }, (_, index) => ({
          name: `tool-${index + 1}`,
          description: `Recorded tool ${index + 1}`,
        })),
        resources: [],
        resourceTemplates: [],
        prompts: [],
        diagnostics: [],
      },
      events: {
        protocol: [],
        network: [],
        stderr: [],
        console: [],
        tasks: [],
        subscriptions: [],
        auth: [],
      },
      attachments: [],
      diagnostics: [],
    }),
  );
}

describe("SessionReplayView", () => {
  it("renders passive metadata and expands recorded JSON", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onToggleTheme = vi.fn();

    renderWithMantine(
      <SessionReplayView
        session={replayStore()}
        version="2.2.0"
        onClose={onClose}
        onToggleTheme={onToggleTheme}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Session Replay" }),
    ).toBeVisible();
    expect(screen.getAllByText("Replay Demo")).toHaveLength(2);
    expect(screen.getByText("Read-only artifact")).toBeVisible();
    expect(screen.getByText("session-1")).toBeVisible();
    expect(screen.getByText("2025-06-18 · modern")).toBeVisible();
    expect(screen.getByText("v2.2.0")).toBeVisible();

    await user.click(screen.getByText("Tools"));
    expect(screen.getByRole("heading", { name: "Tools" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /tool-1/ }));
    expect(screen.getByText(/"description": "Recorded tool 1"/)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Toggle color scheme" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close session replay" }),
    );
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("paginates long recorded sections and resets selection on navigation", async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <SessionReplayView
        session={replayStore(26)}
        onClose={vi.fn()}
        onToggleTheme={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Tools"));
    expect(screen.getByText("tool-1")).toBeVisible();
    expect(screen.queryByText("tool-26")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("tool-26")).toBeVisible();
    expect(screen.queryByText("tool-1")).not.toBeInTheDocument();

    await user.click(screen.getByText("Overview"));
    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();
  });

  it("supports dark mode and artifacts without negotiated protocol metadata", () => {
    renderWithMantine(
      <SessionReplayView
        session={replayStore(1, "none")}
        onClose={vi.fn()}
        onToggleTheme={vi.fn()}
      />,
      { colorScheme: "dark" },
    );

    expect(screen.getByAltText("MCP")).toHaveAttribute("src", mcpLogoDark);
    expect(screen.queryByText(/2025-06-18/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle color scheme" }),
    ).toBeVisible();
  });

  it("shows a protocol version when the artifact omits the era", () => {
    renderWithMantine(
      <SessionReplayView
        session={replayStore(1, "version-only")}
        onClose={vi.fn()}
        onToggleTheme={vi.fn()}
      />,
    );

    expect(screen.getByText("2025-06-18")).toBeVisible();
    expect(screen.queryByText(/2025-06-18 ·/)).not.toBeInTheDocument();
  });
});
