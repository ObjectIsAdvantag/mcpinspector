import { describe, expect, it } from "vitest";
import { ServerDescriptionSnapshotSchema } from "@inspector/core/extensions/api/serverDescription.js";

function snapshot(
  transport: unknown = {
    type: "streamable-http",
    url: "https://mcp.example.com/api",
  },
) {
  return {
    capturedAt: "2026-08-20T10:00:00.000Z",
    protocolVersion: "2025-06-18",
    protocolEra: "modern",
    serverInfo: { name: "example", version: "1.0.0" },
    capabilities: { tools: {} },
    instructions: "Use carefully",
    transport,
    tools: [{ name: "lookup" }],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    diagnostics: [],
  };
}

describe("ServerDescriptionSnapshotSchema", () => {
  it("accepts serializable remote and stdio snapshots", () => {
    expect(ServerDescriptionSnapshotSchema.parse(snapshot())).toMatchObject({
      transport: {
        type: "streamable-http",
        url: "https://mcp.example.com/api",
      },
    });
    expect(
      ServerDescriptionSnapshotSchema.parse(
        snapshot({ type: "stdio", command: "node" }),
      ).transport,
    ).toEqual({ type: "stdio", command: "node" });
    expect(
      ServerDescriptionSnapshotSchema.parse({
        ...snapshot({ type: "sse", url: "http://localhost:3000/sse" }),
        protocolVersion: undefined,
        protocolEra: undefined,
        serverInfo: undefined,
        capabilities: undefined,
        instructions: undefined,
      }).transport,
    ).toEqual({ type: "sse", url: "http://localhost:3000/sse" });
  });

  it.each([
    "ftp://mcp.example.com/api",
    "https://user@mcp.example.com/api",
    "https://:password@mcp.example.com/api",
    "https://mcp.example.com/api?token=secret",
    "https://mcp.example.com/api#secret",
    "not a URL",
  ])("rejects unsafe remote transport URL %s", (url) => {
    expect(
      ServerDescriptionSnapshotSchema.safeParse(
        snapshot({ type: "streamable-http", url }),
      ).success,
    ).toBe(false);
  });

  it("makes headers, environment variables, and unknown source fields unrepresentable", () => {
    expect(
      ServerDescriptionSnapshotSchema.safeParse(
        snapshot({
          type: "streamable-http",
          url: "https://mcp.example.com/api",
          headers: { Authorization: "secret" },
        }),
      ).success,
    ).toBe(false);
    expect(
      ServerDescriptionSnapshotSchema.safeParse(
        snapshot({
          type: "stdio",
          command: "node",
          env: { TOKEN: "secret" },
        }),
      ).success,
    ).toBe(false);
    expect(
      ServerDescriptionSnapshotSchema.safeParse(
        snapshot({
          type: "stdio",
          command: "node",
          args: ["--token", "secret"],
        }),
      ).success,
    ).toBe(false);
    expect(
      ServerDescriptionSnapshotSchema.safeParse({
        ...snapshot(),
        sourceConfig: { headers: { Authorization: "secret" } },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed capture metadata and non-JSON surface values", () => {
    expect(
      ServerDescriptionSnapshotSchema.safeParse({
        ...snapshot(),
        capturedAt: "yesterday",
      }).success,
    ).toBe(false);
    expect(
      ServerDescriptionSnapshotSchema.safeParse({
        ...snapshot(),
        tools: [{ name: "lookup", invalid: undefined }],
      }).success,
    ).toBe(false);
  });
});
