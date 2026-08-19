import { describe, expect, it, vi } from "vitest";
import type { ServerEntry } from "@inspector/core/mcp/types.js";
import { createWebSessionSnapshot } from "./sessionSnapshot";

const server: ServerEntry = {
  id: "filesystem",
  name: "Filesystem",
  config: { type: "stdio", command: "server" },
  settings: {
    headers: [],
    env: [{ key: "TOKEN", value: "secret" }],
    metadata: [],
    connectionTimeout: 0,
    requestTimeout: 0,
    taskTtl: 60_000,
    autoRefreshOnListChanged: false,
    paginatedLists: false,
    maxFetchRequests: 100,
    roots: [],
  },
  connection: { status: "connected" },
};

function context() {
  return {
    inspectorVersion: "2.2.0",
    capturedAt: "2026-08-19T12:00:00.000Z",
    sessionId: "web-session",
    server,
    protocolVersion: "2025-11-25",
    protocolEra: "legacy" as const,
    serverInfo: { name: "filesystem-server", version: "1.0.0" },
    serverCapabilities: { tools: {} },
    clientCapabilities: { roots: {} },
    instructions: "Inspect safely",
    tools: [{ name: "read_file" }],
    resources: [{ uri: "file:///tmp" }],
    resourceTemplates: [{ uriTemplate: "file:///{path}" }],
    prompts: [{ name: "review" }],
    protocol: [{ id: "message-1", timestamp: new Date(0) }],
    network: [{ id: "request-1" }],
    stderr: [{ message: "ready" }],
    console: [{ level: "info", data: "connected" }],
    tasks: [{ taskId: "task-1", status: "working" }],
    subscriptions: [{ resource: { uri: "file:///tmp" } }],
  };
}

describe("createWebSessionSnapshot", () => {
  it("adapts all live Web sections into serializable snapshot data", () => {
    const snapshot = createWebSessionSnapshot(context());

    expect(snapshot).toMatchObject({
      inspectorVersion: "2.2.0",
      sessionId: "web-session",
      server: {
        protocolVersion: "2025-11-25",
        protocolEra: "legacy",
        implementation: { name: "filesystem-server" },
        capabilities: { server: { tools: {} }, client: { roots: {} } },
        instructions: "Inspect safely",
      },
      discovery: {
        tools: [{ name: "read_file" }],
        resources: [{ uri: "file:///tmp" }],
        resourceTemplates: [{ uriTemplate: "file:///{path}" }],
        prompts: [{ name: "review" }],
      },
      events: {
        protocol: [{ id: "message-1", timestamp: "1970-01-01T00:00:00.000Z" }],
        network: [{ id: "request-1" }],
        stderr: [{ message: "ready" }],
        console: [{ level: "info", data: "connected" }],
        tasks: [{ taskId: "task-1", status: "working" }],
        subscriptions: [{ resource: { uri: "file:///tmp" } }],
      },
    });
  });

  it("uses the capture time when no timestamp is supplied", () => {
    const withoutCapturedAt = { ...context(), capturedAt: undefined };
    expect(createWebSessionSnapshot(withoutCapturedAt).capturedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it("rejects circular and unparsable live values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      createWebSessionSnapshot({ ...context(), tools: [circular] }),
    ).toThrow(/Cannot serialize tools\[0\]/);

    const parse = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new SyntaxError("test parse failure");
    });
    expect(() => createWebSessionSnapshot(context())).toThrow(
      /Cannot parse serialized server source/,
    );
    parse.mockRestore();
  });
});
