import { describe, expect, it, vi } from "vitest";
import { collectServerDescriptionSnapshot } from "@inspector/core/extensions/builtin/serverDescriptionSnapshot.js";
import type { MCPServerConfig } from "@inspector/core/mcp/types.js";

function client(
  overrides: Record<string, unknown> = {},
): Parameters<typeof collectServerDescriptionSnapshot>[0]["client"] {
  return {
    getProtocolVersion: vi.fn(() => "2025-11-25"),
    getProtocolEra: vi.fn(() => "legacy" as const),
    getServerInfo: vi.fn(() => ({ name: "demo", version: "1.0.0" })),
    getCapabilities: vi.fn(() => ({
      tools: {},
      resources: {},
      prompts: {},
    })),
    getInstructions: vi.fn(() => "Use carefully"),
    getExcludedTools: vi.fn(() => [
      {
        tool: { name: "hidden", inputSchema: { type: "object" as const } },
        reason: "invalid x-mcp-header annotation",
      },
    ]),
    listAllTools: vi.fn(async () => ({
      tools: [{ name: "visible", inputSchema: { type: "object" } }],
    })),
    listAllResources: vi.fn(async () => ({
      resources: [{ uri: "file:///demo", name: "demo" }],
    })),
    listAllResourceTemplates: vi.fn(async () => ({
      resourceTemplates: [{ uriTemplate: "file:///{name}", name: "file" }],
    })),
    listAllPrompts: vi.fn(async () => ({ prompts: [{ name: "hello" }] })),
    ...overrides,
  } as Parameters<typeof collectServerDescriptionSnapshot>[0]["client"];
}

function context(
  serverConfig: MCPServerConfig,
  overrides: Record<string, unknown> = {},
): Parameters<typeof collectServerDescriptionSnapshot>[0] {
  return {
    client: client(overrides),
    serverConfig,
    capturedAt: "2026-08-20T12:00:00.000Z",
  };
}

describe("collectServerDescriptionSnapshot", () => {
  it("collects all advertised lists in parallel with cache bypass", async () => {
    const source = client();
    const snapshot = await collectServerDescriptionSnapshot({
      client: source,
      serverConfig: { type: "stdio", command: "demo" },
      capturedAt: "2026-08-20T12:00:00.000Z",
    });

    expect(source.listAllTools).toHaveBeenCalledWith({ cacheMode: "bypass" });
    expect(source.listAllResources).toHaveBeenCalledWith({
      cacheMode: "bypass",
    });
    expect(source.listAllResourceTemplates).toHaveBeenCalledWith({
      cacheMode: "bypass",
    });
    expect(source.listAllPrompts).toHaveBeenCalledWith({ cacheMode: "bypass" });
    expect(source.getProtocolVersion).toHaveBeenCalledTimes(1);
    expect(source.getProtocolEra).toHaveBeenCalledTimes(1);
    expect(source.getServerInfo).toHaveBeenCalledTimes(1);
    expect(source.getInstructions).toHaveBeenCalledTimes(1);
    expect(snapshot).toMatchObject({
      capturedAt: "2026-08-20T12:00:00.000Z",
      protocolVersion: "2025-11-25",
      protocolEra: "legacy",
      serverInfo: { name: "demo", version: "1.0.0" },
      transport: { type: "stdio", command: "demo" },
      tools: [{ name: "visible" }],
      diagnostics: [
        expect.objectContaining({
          code: "artifact.tool-excluded",
          message: expect.stringContaining("hidden"),
        }),
      ],
    });
  });

  it("never calls unsupported list methods", async () => {
    const source = client({
      getCapabilities: vi.fn(() => ({ logging: {} })),
    });

    const snapshot = await collectServerDescriptionSnapshot({
      client: source,
      serverConfig: { type: "stdio", command: "demo" },
    });

    expect(source.listAllTools).not.toHaveBeenCalled();
    expect(source.listAllResources).not.toHaveBeenCalled();
    expect(source.listAllResourceTemplates).not.toHaveBeenCalled();
    expect(source.listAllPrompts).not.toHaveBeenCalled();
    expect(snapshot.tools).toEqual([]);
  });

  it("fails the whole collection when an advertised list fails", async () => {
    await expect(
      collectServerDescriptionSnapshot(
        context(
          { type: "stdio", command: "demo" },
          {
            listAllTools: vi.fn(async () => {
              throw new Error("tools failed");
            }),
          },
        ),
      ),
    ).rejects.toThrow("tools failed");
  });

  it("omits stdio arguments and reports the omission without their values", async () => {
    const snapshot = await collectServerDescriptionSnapshot(
      context({
        type: "stdio",
        command: "demo",
        args: ["--token", "secret-canary"],
      }),
    );

    expect(snapshot.transport).toEqual({ type: "stdio", command: "demo" });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("secret-canary");
    expect(serialized).toContain("stdio arguments were omitted");
  });

  it("strips credentials, query parameters, and fragments from remote URLs", async () => {
    const snapshot = await collectServerDescriptionSnapshot(
      context({
        type: "streamable-http",
        url: "https://user:secret@example.com/mcp?token=canary#fragment",
      }),
    );

    expect(snapshot.transport).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("canary");
    expect(serialized).not.toContain("secret");
    expect(serialized).toContain("query parameters");
  });

  it("accepts an already-safe SSE URL without an omission diagnostic", async () => {
    const snapshot = await collectServerDescriptionSnapshot(
      context({ type: "sse", url: "http://localhost:3000/events" }),
    );

    expect(snapshot.transport).toEqual({
      type: "sse",
      url: "http://localhost:3000/events",
    });
    expect(
      snapshot.diagnostics.some(
        ({ code }) => code === "artifact.source-field-omitted",
      ),
    ).toBe(false);
  });

  it("rejects missing capabilities and unsupported remote URL schemes", async () => {
    await expect(
      collectServerDescriptionSnapshot(
        context(
          { type: "stdio", command: "demo" },
          { getCapabilities: vi.fn(() => undefined) },
        ),
      ),
    ).rejects.toThrow("did not provide capabilities");

    await expect(
      collectServerDescriptionSnapshot(
        context({ type: "sse", url: "ftp://example.com/events" }),
      ),
    ).rejects.toThrow("only HTTP(S)");
  });

  it("reports serialization failures without leaking into a malformed DTO", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      collectServerDescriptionSnapshot(
        context(
          { type: "stdio", command: "demo" },
          { getServerInfo: vi.fn(() => circular) },
        ),
      ),
    ).rejects.toThrow("Cannot serialize server info");
  });
});
