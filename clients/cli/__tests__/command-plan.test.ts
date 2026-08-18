import { describe, expect, it, vi } from "vitest";
import { getTestMcpServerCommand } from "@modelcontextprotocol/inspector-test-server";
import { createCliPlan } from "../src/cli.js";
import {
  buildCommandPlan,
  describeOutput,
  describeServerSource,
} from "../src/extensions/commands/plan.js";
import {
  CLI_BUILTIN_CONTRIBUTION_CATALOG,
  CLI_COMMAND_SELECTORS,
  listCommandSelectors,
  resolveCliCommand,
} from "../src/extensions/bootstrap.js";
import {
  executeCommandPlan,
  type CommandPlanHandlers,
} from "../src/extensions/commands/execute.js";
import { runCli } from "./helpers/cli-runner.js";
import { expectCliSuccess } from "./helpers/assertions.js";

const argv = (...args: string[]): string[] => [
  "node",
  "inspector-cli",
  ...args,
];

function expectCommandPlan(plan: ReturnType<typeof createCliPlan>) {
  if (plan.kind === "host") {
    throw new Error("Expected a command plan");
  }
  return plan;
}

describe("CLI command plan creation", () => {
  it("builds the static catalog without provider activation", () => {
    expect(CLI_BUILTIN_CONTRIBUTION_CATALOG.diagnostics).toEqual([]);
    expect(CLI_BUILTIN_CONTRIBUTION_CATALOG.commands).toHaveLength(3);
    expect(CLI_COMMAND_SELECTORS).toEqual(
      expect.arrayContaining([
        "mcp/invoke",
        "servers/list",
        "servers/show",
        "modelcontextprotocol.mcp.invoke",
        "modelcontextprotocol.servers.list",
        "modelcontextprotocol.servers.show",
      ]),
    );
  });

  it.each(["servers/list", "modelcontextprotocol.servers.list"])(
    "canonicalizes %s to the registered list command",
    (selector) => {
      const plan = createCliPlan(
        argv(
          "--config",
          "catalog.json",
          "--command",
          selector,
          "--format",
          "json",
        ),
      );
      expect(plan).toMatchObject({
        kind: "command",
        commandId: "modelcontextprotocol.servers.list",
        extensionId: "modelcontextprotocol.servers",
        connection: "none",
        serverSelection: "all",
        serverSource: { kind: "config", path: "catalog.json" },
        options: {},
        output: {
          destination: { kind: "stdout" },
          encoding: "json",
        },
      });
    },
  );

  it("maps both legacy server methods to canonical registry commands", () => {
    expect(createCliPlan(argv("--method", "servers/list"))).toMatchObject({
      commandId: "modelcontextprotocol.servers.list",
      connection: "none",
    });
    expect(
      createCliPlan(argv("--method", "servers/show", "--server", "example")),
    ).toMatchObject({
      commandId: "modelcontextprotocol.servers.show",
      connection: "resolved",
      serverName: "example",
    });
  });

  it.each(["mcp/invoke", "modelcontextprotocol.mcp.invoke"])(
    "builds a connected MCP plan for %s",
    (selector) => {
      const plan = createCliPlan(
        argv("fake-server", "--command", selector, "--method", "tools/list"),
      );
      expect(plan).toMatchObject({
        kind: "command",
        commandId: "modelcontextprotocol.mcp.invoke",
        extensionId: "modelcontextprotocol.mcp",
        connection: "connected",
        serverSelection: "exactly-one",
        serverSource: { kind: "ad-hoc", target: ["fake-server"] },
        methodArgs: { method: "tools/list" },
      });
    },
  );

  it("keeps --method as the implicit MCP invocation selector", () => {
    expect(
      createCliPlan(argv("fake-server", "--method", "resources/list")),
    ).toMatchObject({
      commandId: "modelcontextprotocol.mcp.invoke",
      connection: "connected",
      methodArgs: { method: "resources/list" },
    });
  });

  it("represents stored-auth utilities as host plans and preserves precedence", () => {
    expect(
      createCliPlan(
        argv(
          "ignored-target",
          "--command",
          "unknown/ignored",
          "--list-stored-auth",
          "--print-handoff",
        ),
      ),
    ).toMatchObject({ kind: "host", operation: "list-stored-auth" });
    expect(
      createCliPlan(
        argv(
          "--server-url",
          "https://example.com/mcp",
          "--transport",
          "http",
          "--print-handoff",
        ),
      ),
    ).toMatchObject({
      kind: "host",
      operation: "print-handoff",
      serverUrl: "https://example.com/mcp",
      transport: "http",
    });
  });

  it("rejects unknown commands and incompatible method selectors", () => {
    expect(() => createCliPlan(argv("--command", "unknown/command"))).toThrow(
      /Unknown command/,
    );
    expect(() =>
      createCliPlan(
        argv("--command", "servers/list", "--method", "tools/list"),
      ),
    ).toThrow(/cannot be combined/);
    expect(() => createCliPlan(argv("--command", "mcp/invoke"))).toThrow(
      /Method is required/,
    );
  });

  it("describes all source and output DTO variants", () => {
    expect(describeServerSource({})).toEqual({ kind: "default-catalog" });
    expect(describeServerSource({ catalogPath: "catalog.json" })).toEqual({
      kind: "catalog",
      path: "catalog.json",
    });
    expect(describeServerSource({ configPath: "config.json" })).toEqual({
      kind: "config",
      path: "config.json",
    });
    expect(
      describeServerSource({ serverUrl: "https://example.com/mcp" }),
    ).toEqual({ kind: "ad-hoc", target: [] });
    expect(describeOutput("text")).toEqual({
      destination: { kind: "stdout" },
      encoding: "text",
    });

    const registration = resolveCliCommand("servers/list");
    expect(buildCommandPlan(registration, {}, "text")).toMatchObject({
      kind: "command",
      commandId: "modelcontextprotocol.servers.list",
      connection: "none",
      serverSelection: "all",
    });
  });

  it("reports all valid selectors for an unknown command", () => {
    expect(() => resolveCliCommand("missing/command")).toThrow(
      /mcp\/invoke.*servers\/list.*servers\/show/,
    );
  });

  it("lists a canonical selector when a command has no aliases", () => {
    expect(
      listCommandSelectors({
        extensions: [],
        commands: [
          {
            extensionId: "example.extension",
            contribution: {
              id: "example.command",
              title: "Example",
              connection: "none",
              serverSelection: "none",
            },
          },
        ],
        artifactFormats: [],
        diagnostics: [],
      }),
    ).toEqual(["example.command"]);
  });
});

describe("executeCommandPlan", () => {
  function handlers() {
    const runWithoutConnection =
      vi.fn<CommandPlanHandlers["runWithoutConnection"]>();
    const runWithResolvedServer =
      vi.fn<CommandPlanHandlers["runWithResolvedServer"]>();
    const runWithConnection = vi.fn<CommandPlanHandlers["runWithConnection"]>();
    return {
      handlers: {
        runWithoutConnection,
        runWithResolvedServer,
        runWithConnection,
      },
      runWithoutConnection,
      runWithResolvedServer,
      runWithConnection,
    };
  }

  it("does not enter connected execution for list or show metadata", async () => {
    const calls = handlers();
    const list = expectCommandPlan(
      createCliPlan(argv("fake-server", "--command", "servers/list")),
    );
    const show = expectCommandPlan(
      createCliPlan(
        argv("fake-server", "--command", "servers/show", "--server", "default"),
      ),
    );

    await executeCommandPlan(list, calls.handlers);
    await executeCommandPlan(show, calls.handlers);

    expect(calls.runWithoutConnection).toHaveBeenCalledOnce();
    expect(calls.runWithResolvedServer).toHaveBeenCalledOnce();
    expect(calls.runWithConnection).not.toHaveBeenCalled();
  });

  it("dispatches a connected command to its handler", async () => {
    const calls = handlers();
    const connected = expectCommandPlan(
      createCliPlan(argv("fake-server", "--method", "tools/list")),
    );

    await executeCommandPlan(connected, calls.handlers);

    expect(calls.runWithConnection).toHaveBeenCalledOnce();
  });
});

describe("explicit MCP command execution", () => {
  it.each(["mcp/invoke", "modelcontextprotocol.mcp.invoke"])(
    "invokes the existing MCP provider via %s",
    async (selector) => {
      const { command, args } = getTestMcpServerCommand();
      const result = await runCli([
        command,
        ...args,
        "--command",
        selector,
        "--method",
        "tools/list",
      ]);
      expectCliSuccess(result);
      expect(JSON.parse(result.stdout)).toHaveProperty("tools");
    },
  );
});
