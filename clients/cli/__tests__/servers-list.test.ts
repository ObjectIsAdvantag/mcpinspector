import { describe, it, expect, afterEach } from "vitest";
import { runCli } from "./helpers/cli-runner.js";
import {
  createSampleTestConfig,
  deleteConfigFile,
} from "./helpers/fixtures.js";
import { expectCliSuccess } from "./helpers/assertions.js";
import { expectCliFailure } from "./helpers/assertions.js";

describe("servers/list command", () => {
  let configPath: string | undefined;

  afterEach(() => {
    if (configPath) {
      deleteConfigFile(configPath);
      configPath = undefined;
    }
  });

  it("works via --method servers/list", async () => {
    configPath = createSampleTestConfig();
    const result = await runCli([
      "--config",
      configPath,
      "--method",
      "servers/list",
      "--format",
      "json",
    ]);
    expectCliSuccess(result);
    const body = JSON.parse(result.stdout) as {
      result: { servers: { name: string }[] };
    };
    expect(body.result.servers.map((s) => s.name).sort()).toEqual([
      "test-http",
      "test-stdio",
    ]);
  });

  it.each(["servers/list", "modelcontextprotocol.servers.list"])(
    "works via --command %s",
    async (command) => {
      configPath = createSampleTestConfig();
      const result = await runCli([
        "--config",
        configPath,
        "--command",
        command,
        "--format",
        "json",
      ]);
      expectCliSuccess(result);
      const body = JSON.parse(result.stdout) as {
        result: { servers: { name: string }[] };
      };
      expect(body.result.servers).toHaveLength(2);
    },
  );

  it("does not read OAuth/client settings for a no-connection plan", async () => {
    configPath = createSampleTestConfig();
    const result = await runCli([
      "--config",
      configPath,
      "--command",
      "servers/list",
      "--use-stored-auth",
      "--client-config",
      "/missing/client.json",
      "--callback-url",
      "https://not-loopback.example/callback",
    ]);
    expectCliSuccess(result);
  });

  it("summarizes an ad-hoc command without spawning its transport", async () => {
    const result = await runCli([
      "definitely-not-an-installed-command",
      "--command",
      "servers/list",
      "--format",
      "json",
    ]);
    expectCliSuccess(result);
    expect(result.stdout).toContain("definitely-not-an-installed-command");
  });
});

describe("servers/show command", () => {
  let configPath: string | undefined;

  afterEach(() => {
    if (configPath) {
      deleteConfigFile(configPath);
      configPath = undefined;
    }
  });

  it("works via --method servers/show --server", async () => {
    configPath = createSampleTestConfig();
    const result = await runCli([
      "--config",
      configPath,
      "--method",
      "servers/show",
      "--server",
      "test-http",
      "--format",
      "json",
    ]);
    expectCliSuccess(result);
    const body = JSON.parse(result.stdout) as {
      result: { name: string; type: string };
    };
    expect(body.result.name).toBe("test-http");
    expect(body.result.type).toBe("streamable-http");
  });

  it.each(["servers/show", "modelcontextprotocol.servers.show"])(
    "works via --command %s",
    async (command) => {
      configPath = createSampleTestConfig();
      const result = await runCli([
        "--config",
        configPath,
        "--command",
        command,
        "--server",
        "test-stdio",
        "--format",
        "json",
      ]);
      expectCliSuccess(result);
      expect(result.stdout).toContain('"name":"test-stdio"');
    },
  );

  it("rejects servers/show without --server", async () => {
    configPath = createSampleTestConfig();
    const result = await runCli([
      "--config",
      configPath,
      "--method",
      "servers/show",
    ]);
    expectCliFailure(result);
    expect(result.stderr).toMatch(/--server/);
  });

  it("rejects unknown server names", async () => {
    configPath = createSampleTestConfig();
    const result = await runCli([
      "--config",
      configPath,
      "--command",
      "servers/show",
      "--server",
      "nope",
    ]);
    expectCliFailure(result);
    expect(result.stderr).toMatch(/not found/);
  });

  it("resolves an ad-hoc server without starting its transport", async () => {
    const result = await runCli([
      "definitely-not-an-installed-command",
      "--command",
      "servers/show",
      "--server",
      "default",
      "--format",
      "json",
    ]);
    expectCliSuccess(result);
    expect(result.stdout).toContain("definitely-not-an-installed-command");
  });
});
