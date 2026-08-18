import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  annotateServerEntriesWithSessions,
  listServerEntries,
  sanitizeServerConfig,
  sanitizeServerSettings,
  showServerEntry,
  summarizeServerConfig,
} from "@inspector/core/extensions/builtin/servers/catalog.js";
import {
  InMemorySecretStore,
  SECRET_FIELD_OAUTH_CLIENT_SECRET,
  envSecretField,
} from "@inspector/core/auth/node/secret-store.js";
import type {
  InspectorServerSettings,
  MCPServerConfig,
} from "@inspector/core/mcp/types.js";

describe("built-in server catalog providers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "extension-servers-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(mcpServers: Record<string, unknown>): string {
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(configPath, JSON.stringify({ mcpServers }));
    return configPath;
  }

  it("summarizes stdio and URL transports without resolving them", () => {
    expect(
      summarizeServerConfig({
        type: "stdio",
        command: "node",
        args: ["server.js"],
      }),
    ).toEqual({ type: "stdio", detail: "node server.js" });
    expect(summarizeServerConfig({ type: "stdio", command: "python" })).toEqual(
      { type: "stdio", detail: "python" },
    );
    expect(
      summarizeServerConfig({
        type: "sse",
        url: "https://example.com/sse",
      }),
    ).toEqual({ type: "sse", detail: "https://example.com/sse" });
    expect(
      summarizeServerConfig({
        type: "streamable-http",
        url: "https://example.com/mcp",
      }),
    ).toEqual({
      type: "streamable-http",
      detail: "https://example.com/mcp",
    });
    expect(
      summarizeServerConfig({
        type: "streamable-http",
      } as MCPServerConfig),
    ).toEqual({ type: "streamable-http", detail: "" });
  });

  it("annotates matching sessions without mutating catalog entries", () => {
    const entries = [
      { name: "alpha", type: "stdio", detail: "node alpha" },
      { name: "beta", type: "stdio", detail: "node beta" },
    ];
    expect(annotateServerEntriesWithSessions(entries, [])).toBe(entries);
    expect(
      annotateServerEntriesWithSessions(entries, [
        { name: "alpha", isMru: false },
        { name: "beta", isMru: true },
        { name: "missing" },
      ]),
    ).toEqual([
      {
        name: "alpha",
        type: "stdio",
        detail: "node alpha",
        session: "alpha",
      },
      {
        name: "beta",
        type: "stdio",
        detail: "node beta",
        session: "beta",
        isMru: true,
      },
    ]);
  });

  it("redacts environment values and every sensitive header spelling", () => {
    expect(
      sanitizeServerConfig({
        type: "stdio",
        command: "node",
        env: { SECRET: "value", HELLO: "world" },
      }),
    ).toEqual({
      type: "stdio",
      command: "node",
      env: { SECRET: "[redacted]", HELLO: "[redacted]" },
    });

    const sanitized = sanitizeServerConfig({
      type: "streamable-http",
      url: "https://example.com/mcp",
      requestInit: {
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=abc",
          "X-Secret": "secret",
          "X-Token": "token",
          "X-Password": "password",
          "X-Api-Key": "key",
          "X-ApiKey": "key-two",
          "X-Custom": "visible",
        },
      },
      eventSourceInit: {
        headers: [
          ["Authorization", "Bearer event"],
          ["X-Custom", "visible"],
          [42, "unchanged"],
          ["too-short"],
          "unchanged",
        ],
      },
    } as MCPServerConfig);

    expect(sanitized.requestInit).toEqual({
      headers: {
        Authorization: "[redacted]",
        Cookie: "[redacted]",
        "X-Secret": "[redacted]",
        "X-Token": "[redacted]",
        "X-Password": "[redacted]",
        "X-Api-Key": "[redacted]",
        "X-ApiKey": "[redacted]",
        "X-Custom": "visible",
      },
    });
    expect(sanitized.eventSourceInit).toEqual({
      headers: [
        ["Authorization", "[redacted]"],
        ["X-Custom", "visible"],
        [42, "unchanged"],
        ["too-short"],
        "unchanged",
      ],
    });
  });

  it("preserves non-header init fields and redacts Inspector settings", () => {
    expect(
      sanitizeServerConfig({
        type: "streamable-http",
        url: "https://example.com/mcp",
        requestInit: { method: "POST" },
      } as MCPServerConfig),
    ).toMatchObject({ requestInit: { method: "POST" } });

    const settings: InspectorServerSettings = {
      headers: [
        { key: "Authorization", value: "Bearer x" },
        { key: "X-Custom", value: "visible" },
      ],
      metadata: [
        { key: "session-token", value: "secret" },
        { key: "region", value: "west" },
      ],
      env: [
        { key: "TOKEN", value: "secret" },
        { key: "", value: "also-secret" },
      ],
      connectionTimeout: 0,
      requestTimeout: 0,
      taskTtl: 60_000,
      maxFetchRequests: 100,
      roots: [],
      oauthClientId: "client-id",
      oauthClientSecret: "client-secret",
    };
    const sanitized = sanitizeServerSettings(settings);
    expect(sanitized).toMatchObject({
      headers: [
        { key: "Authorization", value: "[redacted]" },
        { key: "X-Custom", value: "visible" },
      ],
      metadata: [
        { key: "session-token", value: "[redacted]" },
        { key: "region", value: "west" },
      ],
      env: [
        { key: "TOKEN", value: "[redacted]" },
        { key: "", value: "[redacted]" },
      ],
      oauthClientId: "client-id",
      oauthClientSecret: "[redacted]",
    });
    const withoutSecret = { ...settings };
    delete withoutSecret.oauthClientSecret;
    expect(sanitizeServerSettings(withoutSecret)).not.toHaveProperty(
      "oauthClientSecret",
    );
  });

  it("lists entries in deterministic name order without reading secrets", async () => {
    const configPath = writeConfig({
      zebra: { type: "streamable-http", url: "https://example.com/mcp" },
      alpha: { command: "node", args: ["alpha.js"] },
    });
    await expect(listServerEntries({ configPath })).resolves.toEqual([
      { name: "alpha", type: "stdio", detail: "node alpha.js" },
      {
        name: "zebra",
        type: "streamable-http",
        detail: "https://example.com/mcp",
      },
    ]);
    await expect(
      listServerEntries({
        configPath,
        secretStore: new InMemorySecretStore(),
      }),
    ).resolves.toHaveLength(2);
  });

  it("shows one resolved entry and redacts rehydrated secrets", async () => {
    const configPath = writeConfig({
      local: {
        command: "node",
        env: { HELLO: "" },
      },
      remote: {
        type: "streamable-http",
        url: "https://example.com/mcp",
        oauth: { clientId: "client-id" },
      },
    });
    const secretStore = new InMemorySecretStore();
    await secretStore.set("local", envSecretField("HELLO"), "env-canary");
    await secretStore.set(
      "remote",
      SECRET_FIELD_OAUTH_CLIENT_SECRET,
      "oauth-canary",
    );

    const local = await showServerEntry(" local ", {
      configPath,
      secretStore,
    });
    expect(local).toMatchObject({
      name: "local",
      type: "stdio",
      config: { env: { HELLO: "[redacted]" } },
    });
    expect(JSON.stringify(local)).not.toContain("env-canary");

    const remote = await showServerEntry("remote", {
      configPath,
      secretStore,
    });
    expect(remote.settings).toMatchObject({
      oauthClientId: "client-id",
      oauthClientSecret: "[redacted]",
    });
    expect(JSON.stringify(remote)).not.toContain("oauth-canary");
  });

  it("rejects an empty or unknown server name", async () => {
    const configPath = writeConfig({ local: { command: "node" } });
    await expect(showServerEntry(" ", { configPath })).rejects.toThrow(
      "servers/show requires a server name",
    );
    await expect(
      showServerEntry("missing", {
        configPath,
        secretStore: new InMemorySecretStore(),
      }),
    ).rejects.toThrow(/not found/);
  });
});
