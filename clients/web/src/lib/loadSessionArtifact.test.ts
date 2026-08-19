import { describe, expect, it, vi } from "vitest";
import { NativeSessionArtifactSchema } from "@inspector/core/extensions/api/sessions.js";
import { loadNativeSessionReplay } from "./loadSessionArtifact";

function validArtifactContent(): string {
  return JSON.stringify(
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
      server: { implementation: { name: "Demo Server" } },
      discovery: {
        tools: [{ name: "echo" }],
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

describe("loadNativeSessionReplay", () => {
  it("reads, validates, and projects a local native-session file", async () => {
    const file = new File([validArtifactContent()], "session.json", {
      type: "application/json",
    });

    await expect(loadNativeSessionReplay(file)).resolves.toMatchObject({
      metadata: {
        sessionId: "session-1",
        serverName: "Demo Server",
      },
      sections: [
        { id: "overview", entries: [{ label: "Session metadata" }] },
        { id: "tools", entries: [{ label: "echo" }] },
      ],
    });
  });

  it("rejects an oversized file before reading it", async () => {
    const file = new File(["oversized"], "session.json");
    const text = vi.spyOn(file, "text");

    await expect(loadNativeSessionReplay(file, 1)).rejects.toThrow(
      "Session artifact exceeds the 1-byte limit",
    );
    expect(text).not.toHaveBeenCalled();
  });

  it("wraps local file read failures", async () => {
    const file = new File(["{}"], "session.json");
    vi.spyOn(file, "text").mockRejectedValue(new Error("disk unavailable"));

    await expect(loadNativeSessionReplay(file)).rejects.toThrow(
      "Could not read the selected session artifact",
    );
  });

  it("reports parser diagnostics with and without field paths", async () => {
    const invalidJson = new File(["{"], "invalid.json");
    await expect(loadNativeSessionReplay(invalidJson)).rejects.toThrow(
      "Session artifact is not valid JSON",
    );

    const invalidSchema = new File(
      [
        JSON.stringify({
          header: {
            format: {
              id: "modelcontextprotocol.inspector-session-1",
              version: "1.0.0",
            },
          },
        }),
      ],
      "invalid-schema.json",
    );
    await expect(loadNativeSessionReplay(invalidSchema)).rejects.toThrow(
      /at header\.|at server|at discovery/,
    );
    await expect(loadNativeSessionReplay(invalidSchema)).rejects.toThrow(
      /more diagnostics$/,
    );
  });

  it("retains the parser byte limit even for inconsistent File metadata", async () => {
    const file = new File([validArtifactContent()], "session.json");
    Object.defineProperty(file, "size", { value: 0 });

    await expect(loadNativeSessionReplay(file, 1)).rejects.toThrow(
      "Session artifact exceeds the 1-byte limit",
    );
  });
});
