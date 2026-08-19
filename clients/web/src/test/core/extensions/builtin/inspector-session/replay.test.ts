import { describe, expect, it } from "vitest";
import {
  NativeSessionArtifactSchema,
  type NativeSessionArtifact,
} from "@inspector/core/extensions/api/sessions.js";
import { ExtensionJsonObjectSchema } from "@inspector/core/extensions/api/json.js";
import { createNativeSessionReplayStore } from "@inspector/core/extensions/builtin/inspector-session/replay.js";

function artifact(
  overrides: Partial<NativeSessionArtifact> = {},
): NativeSessionArtifact {
  return NativeSessionArtifactSchema.parse({
    header: {
      format: {
        id: "modelcontextprotocol.inspector-session-1",
        version: "1.0.0",
      },
      inspectorVersion: "2.2.0",
      capturedAt: "2026-08-19T10:15:00.000Z",
      sessionId: "session-1",
    },
    server: {},
    discovery: {
      tools: [],
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
    ...overrides,
  });
}

function section(
  store: ReturnType<typeof createNativeSessionReplayStore>,
  id: string,
) {
  const result = store.sections.find((candidate) => candidate.id === id);
  expect(result).toBeDefined();
  if (!result) throw new Error(`Missing replay section: ${id}`);
  return result;
}

describe("createNativeSessionReplayStore", () => {
  it("projects every non-empty section and preserves same-version extension data", () => {
    const longMessage = "x".repeat(120);
    const input = artifact({
      server: {
        source: { name: "configured-name", id: "configured-id" },
        implementation: { name: "Demo Server", version: "1.0.0" },
        protocolVersion: "2025-06-18",
        protocolEra: "modern",
        futureServerField: { preserved: true },
      },
      discovery: {
        tools: [
          { name: "echo" },
          { inputSchema: {} },
          ExtensionJsonObjectSchema.parse(
            JSON.parse('{"name":"safe","__proto__":{"polluted":true}}'),
          ),
        ],
        resources: [{ uri: "file:///readme.md" }],
        resourceTemplates: [{ uriTemplate: "file:///{path}" }],
        prompts: [{ name: "review" }],
        diagnostics: [
          {
            code: "discovery.partial",
            severity: "warning",
            message: "Discovery was partial",
            path: ["tools"],
          },
        ],
        futureDiscoveryField: ["preserved"],
      },
      events: {
        protocol: [{ message: { method: "tools/list" } }, { message: null }],
        network: [
          { method: "POST", url: "https://example.test/mcp" },
          { url: "" },
        ],
        stderr: [{ message: longMessage }],
        console: [{ logger: "root", level: "info" }],
        tasks: [{ taskId: "task-1", status: "working" }],
        subscriptions: [
          { resource: { uri: "file:///watched.md" } },
          { resource: "invalid-recorded-value" },
        ],
        auth: [{ type: "oauth", url: "https://auth.example.test" }],
        futureEventField: { preserved: true },
      },
      attachments: [
        {
          id: "attachment-1",
          mediaType: "application/json",
          byteLength: 12,
          reference: "files/attachment-1.json",
        },
      ],
      diagnostics: [
        {
          code: "artifact.redacted",
          severity: "info",
          message: "A value was redacted",
          path: ["server", "source"],
        },
      ],
      futureTopLevelField: { preserved: true },
    });

    const store = createNativeSessionReplayStore(input);

    expect(store.metadata).toEqual({
      formatId: "modelcontextprotocol.inspector-session-1",
      formatVersion: "1.0.0",
      inspectorVersion: "2.2.0",
      capturedAt: "2026-08-19T10:15:00.000Z",
      sessionId: "session-1",
      serverName: "Demo Server",
      protocolVersion: "2025-06-18",
      protocolEra: "modern",
    });
    expect(store.sections.map(({ id }) => id)).toEqual([
      "overview",
      "tools",
      "resources",
      "resourceTemplates",
      "prompts",
      "protocol",
      "network",
      "stderr",
      "console",
      "tasks",
      "subscriptions",
      "auth",
      "attachments",
      "diagnostics",
      "additional",
    ]);
    expect(section(store, "tools").entries.map(({ label }) => label)).toEqual([
      "echo",
      "Entry 2",
      "safe",
    ]);
    expect(section(store, "tools").entries[2]?.value).toEqual({ name: "safe" });
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(
      section(store, "protocol").entries.map(({ label }) => label),
    ).toEqual(["tools/list", "Entry 2"]);
    expect(section(store, "network").entries.map(({ label }) => label)).toEqual(
      ["POST https://example.test/mcp", "Entry 2"],
    );
    expect(
      section(store, "subscriptions").entries.map(({ label }) => label),
    ).toEqual(["file:///watched.md", "Entry 2"]);
    expect(
      section(store, "diagnostics").entries.map(({ label }) => label),
    ).toEqual(["WARNING · discovery.partial", "INFO · artifact.redacted"]);
    expect(section(store, "stderr").entries[0]?.label).toHaveLength(96);
    expect(section(store, "additional").entries[0]?.value).toEqual({
      artifact: { futureTopLevelField: { preserved: true } },
      discovery: { futureDiscoveryField: ["preserved"] },
      events: { futureEventField: { preserved: true } },
    });
    expect(section(store, "overview").entries[0]?.value).toEqual({
      header: input.header,
      server: input.server,
    });
    expect(Object.isFrozen(store)).toBe(true);
    expect(Object.isFrozen(store.sections)).toBe(true);
    expect(
      Object.isFrozen(section(store, "additional").entries[0]!.value),
    ).toBe(true);
  });

  it.each([
    [{ source: { name: "Source Name", id: "source-id" } }, "Source Name"],
    [{ source: { id: "source-id" } }, "source-id"],
    [{ source: { name: "   ", id: "" } }, "Unknown server"],
  ] as const)(
    "derives a safe server title from passive metadata",
    (server, name) => {
      const store = createNativeSessionReplayStore(artifact({ server }));

      expect(store.metadata.serverName).toBe(name);
      expect(store.metadata).not.toHaveProperty("protocolVersion");
      expect(store.metadata).not.toHaveProperty("protocolEra");
      expect(store.sections.map(({ id }) => id)).toEqual(["overview"]);
    },
  );
});
