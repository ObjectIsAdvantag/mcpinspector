import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { NativeSessionArtifactSchema } from "@inspector/core/extensions/api/sessions.js";
import { createNativeSessionReplayStore } from "@inspector/core/extensions/builtin/inspector-session/replay.js";
import { SessionReplayView } from "./SessionReplayView";

const session = createNativeSessionReplayStore(
  NativeSessionArtifactSchema.parse({
    header: {
      format: {
        id: "modelcontextprotocol.inspector-session-1",
        version: "1.0.0",
      },
      inspectorVersion: "2.2.0",
      capturedAt: "2026-08-19T10:15:00.000Z",
      sessionId: "storybook-session-1",
    },
    server: {
      source: {
        type: "streamable-http",
        url: "https://example.test/mcp",
      },
      implementation: { name: "Weather Service", version: "1.4.0" },
      protocolVersion: "2025-06-18",
      protocolEra: "modern",
      capabilities: { tools: { listChanged: true }, resources: {} },
    },
    discovery: {
      tools: [
        {
          name: "forecast",
          description: "Return the recorded forecast for a city",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
        {
          name: "alerts",
          description: "List recorded weather alerts",
          inputSchema: { type: "object" },
        },
      ],
      resources: [
        {
          name: "Forecast archive",
          uri: "weather://archive/today",
          mimeType: "application/json",
        },
      ],
      resourceTemplates: [],
      prompts: [{ name: "summarize-weather" }],
      diagnostics: [],
    },
    events: {
      protocol: [
        {
          timestamp: "2026-08-19T10:15:01.000Z",
          direction: "client-to-server",
          message: { jsonrpc: "2.0", id: 1, method: "tools/list" },
        },
      ],
      network: [
        {
          timestamp: "2026-08-19T10:15:01.010Z",
          method: "POST",
          url: "https://example.test/mcp",
          status: 200,
        },
      ],
      stderr: [],
      console: [
        {
          timestamp: "2026-08-19T10:15:02.000Z",
          level: "info",
          logger: "weather",
          data: "Forecast cache ready",
        },
      ],
      tasks: [],
      subscriptions: [],
      auth: [],
    },
    attachments: [],
    diagnostics: [
      {
        code: "artifact.value-redacted",
        severity: "info",
        message: "A recorded authorization value was redacted",
        path: ["server", "source", "headers", "Authorization"],
      },
    ],
  }),
);

const meta: Meta<typeof SessionReplayView> = {
  title: "Views/SessionReplayView",
  component: SessionReplayView,
  parameters: { layout: "fullscreen" },
  args: {
    session,
    version: "2.2.0",
    onClose: fn(),
    onToggleTheme: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SessionReplayView>;

export const RecordedSession: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const heading = await body.findByRole("heading", {
      name: "Session Replay",
    });
    await expect(heading).toBeVisible();
    await expect(body.getByText("Read-only artifact")).toBeVisible();

    await userEvent.click(body.getByText("Tools"));
    await userEvent.click(body.getByRole("button", { name: /forecast/ }));
    await expect(
      body.getByText(/Return the recorded forecast for a city/),
    ).toBeVisible();
  },
};
