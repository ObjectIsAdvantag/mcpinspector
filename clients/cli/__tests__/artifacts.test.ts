import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getTestMcpServerCommand } from "@modelcontextprotocol/inspector-test-server";
import {
  INSPECTOR_SESSION_FORMAT_ID,
  parseNativeSessionArtifact,
} from "@inspector/core/extensions/api/sessions.js";
import { runCli } from "./helpers/cli-runner.js";
import { expectCliSuccess } from "./helpers/assertions.js";
import {
  buildCliArtifactPlan,
  buildCliArtifactPlanFromContribution,
} from "../src/extensions/artifacts/plan.js";
import {
  assertCliArtifactApplicable,
  executeCliArtifactExport,
} from "../src/extensions/artifacts/execute.js";
import {
  createCliSessionSnapshot,
  type CliSessionSnapshotContext,
} from "../src/extensions/artifacts/snapshot-source.js";
import type { MethodOutcome } from "../src/handlers/method-types.js";
import { parse } from "yaml";
import {
  MCPDESC_0_7_ARTIFACT_VERSION,
  MCPDESC_0_7_FORMAT_ID,
} from "@inspector/core/extensions/builtin/mcpdesc-0.7/constants.js";
import { validateMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/validation.js";
import {
  MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
  MCPDESC_0_8_DRAFT_1_FORMAT_ID,
} from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/constants.js";
import { validateMcpDescription08Draft1Document } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/validation.js";

const SECRET_CANARY = "artifact-secret-canary";
const tempDirs: string[] = [];

function tempArtifactPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "inspector-cli-artifact-"));
  tempDirs.push(dir);
  return join(dir, "nested", "session.json");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("CLI native session artifacts", () => {
  it("exports a parseable, redacted connected invocation to a file", async () => {
    const { command, args } = getTestMcpServerCommand();
    const outputPath = tempArtifactPath();
    const result = await runCli([
      command,
      ...args,
      "--method",
      "tools/list",
      "-e",
      `OPENAI_API_KEY=${SECRET_CANARY}`,
      "--metadata",
      `api_key=${SECRET_CANARY}`,
      "--artifact-plugin",
      "inspector-session",
      "--output",
      outputPath,
    ]);

    expectCliSuccess(result);
    expect(JSON.parse(result.stdout)).toHaveProperty("tools");
    const serialized = readFileSync(outputPath, "utf8");
    expect(serialized).not.toContain(SECRET_CANARY);
    const parsed = parseNativeSessionArtifact(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Expected a valid session artifact");
    expect(parsed.artifact.header.format.id).toBe(INSPECTOR_SESSION_FORMAT_ID);
    expect(parsed.artifact.discovery.tools.length).toBeGreaterThan(0);
    expect(parsed.artifact.events.protocol.length).toBeGreaterThan(0);
    expect(parsed.artifact.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "artifact.value-redacted" }),
      ]),
    );
  });

  it("writes only the artifact document when stdout is the sink", async () => {
    const { command, args } = getTestMcpServerCommand();
    const result = await runCli([
      command,
      ...args,
      "--method",
      "initialize",
      "--artifact-plugin",
      INSPECTOR_SESSION_FORMAT_ID,
      "--output",
      "-",
    ]);

    expectCliSuccess(result);
    const parsed = parseNativeSessionArtifact(result.stdout);
    expect(parsed.ok).toBe(true);
    expect(result.stdout.trim().split("\n")[0]).toBe("{");
  });
});

describe("CLI MCP Description 0.7 artifacts", () => {
  it("exports a fresh valid JSON description without requiring --method", async () => {
    const { command, args } = getTestMcpServerCommand();
    const result = await runCli([
      command,
      ...args,
      "--artifact-plugin",
      "mcpdesc-0.7",
      "--output",
      "-",
    ]);

    expectCliSuccess(result);
    const document: unknown = JSON.parse(result.stdout);
    expect(document).toMatchObject({
      mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION,
      info: { name: expect.any(String), version: expect.any(String) },
      transports: [{ type: "stdio", command }],
      tools: expect.any(Array),
    });
    expect(validateMcpDescription07Document(document)).toEqual([]);
    expect(result.stdout.trim().split("\n")[0]).toBe("{");
    expect(result.stderr).toContain(
      "[artifact warning] artifact.source-field-omitted",
    );
    expect(result.stderr).toContain("stdio arguments were omitted");
  });

  it("exports YAML to a host-owned file with no stdout artifact", async () => {
    const { command, args } = getTestMcpServerCommand();
    const outputPath = tempArtifactPath().replace(
      /session\.json$/,
      "server.yaml",
    );
    const result = await runCli([
      command,
      ...args,
      "--artifact-plugin",
      MCPDESC_0_7_FORMAT_ID,
      "--encoding",
      "yaml",
      "--output",
      outputPath,
    ]);

    expectCliSuccess(result);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("stdio arguments were omitted");
    const document: unknown = parse(readFileSync(outputPath, "utf8"));
    expect(validateMcpDescription07Document(document)).toEqual([]);
    expect(document).toMatchObject({ mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION });
  });
});

describe("CLI MCP Description 0.8.0 Draft 1 artifacts", () => {
  it("exports a fresh valid Draft 1 description without requiring --method", async () => {
    const { command, args } = getTestMcpServerCommand();
    const result = await runCli([
      command,
      ...args,
      "--artifact-plugin",
      "mcpdesc-0.8-draft.1",
      "--output",
      "-",
    ]);

    expectCliSuccess(result);
    const document: unknown = JSON.parse(result.stdout);
    expect(document).toMatchObject({
      mcpdesc: "0.8.0",
      protocolVersions: [expect.any(String)],
      info: { name: expect.any(String), version: expect.any(String) },
      transports: [{ type: "stdio", command }],
      tools: expect.any(Array),
    });
    expect(
      validateMcpDescription08Draft1Document(document).some(
        ({ severity }) => severity === "error",
      ),
    ).toBe(false);
    expect(result.stdout.trim().split("\n")[0]).toBe("{");
  });

  it("resolves the canonical format id and artifact version", () => {
    const plan = buildCliArtifactPlan(
      MCPDESC_0_8_DRAFT_1_FORMAT_ID,
      "yaml",
      undefined,
    );
    expect(plan).toMatchObject({
      formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
      artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
      encoding: "yaml",
    });
    expect(() => assertCliArtifactApplicable(plan, "2026-07-28")).not.toThrow();
  });
});

function snapshotContext(outcome: MethodOutcome): CliSessionSnapshotContext {
  return {
    inspectorVersion: "2.2.0",
    capturedAt: "2026-08-19T08:00:00.000Z",
    sessionId: "test-session",
    serverConfig: { type: "stdio", command: "example" },
    client: {
      getProtocolVersion: () => undefined,
      getProtocolEra: () => undefined,
      getServerInfo: () => undefined,
      getCapabilities: () => undefined,
      getClientCapabilities: () => ({}),
      getInstructions: () => undefined,
    },
    methodArgs: { method: "tools/list" },
    outcome,
    messages: { getMessages: () => [] },
    network: { getFetchRequests: () => [] },
    stderr: { getStderrLogs: () => [] },
  };
}

describe("CLI artifact planning and snapshot adaptation", () => {
  it("keeps stdout as the default artifact destination", () => {
    expect(
      buildCliArtifactPlan("inspector-session", undefined, undefined).output,
    ).toEqual({ kind: "stdout" });
  });

  it("rejects contributions without export or a media type", () => {
    const contribution = {
      id: "example.format",
      displayName: "Example",
      artifactVersion: "1.0.0",
      mediaTypes: ["application/json"],
      encodings: ["json"],
      operationRequirements: {
        validate: {
          dataRequirements: {
            serverDescription: "none" as const,
            session: "read" as const,
          },
        },
      },
    };
    expect(() =>
      buildCliArtifactPlanFromContribution(
        "example",
        { extensionId: "example", contribution },
        undefined,
        undefined,
      ),
    ).toThrow(/does not support export/);
    expect(() =>
      buildCliArtifactPlanFromContribution(
        "example",
        {
          extensionId: "example",
          contribution: {
            ...contribution,
            operationRequirements: {
              export: {
                dataRequirements: {
                  serverDescription: "none",
                  session: "read",
                },
              },
            },
            mediaTypes: [],
          },
        },
        undefined,
        undefined,
      ),
    ).toThrow(/declares no media type/);
  });

  it("pairs each selected encoding with its same-index media type", () => {
    const artifact = buildCliArtifactPlanFromContribution(
      "example",
      {
        extensionId: "example",
        contribution: {
          id: "example.format",
          displayName: "Example",
          artifactVersion: "1.0.0",
          mediaTypes: ["application/example+json", "application/example+yaml"],
          encodings: ["json", "yaml"],
          operationRequirements: {
            export: {
              dataRequirements: {
                serverDescription: "read",
                session: "none",
              },
            },
          },
        },
      },
      "yaml",
      undefined,
    );
    expect(artifact).toMatchObject({
      encoding: "yaml",
      mediaType: "application/example+yaml",
    });
  });

  it("preflights the negotiated protocol before artifact execution", () => {
    const plan = buildCliArtifactPlan("mcpdesc-0.7", undefined, undefined);
    expect(() => assertCliArtifactApplicable(plan, "2026-07-28")).toThrow(
      /does not support negotiated MCP protocol version 2026-07-28/,
    );
    expect(() => assertCliArtifactApplicable(plan, undefined)).toThrow(
      /no negotiated MCP protocol version/,
    );
    expect(() => assertCliArtifactApplicable(plan, "2025-11-25")).not.toThrow();
  });

  it("adapts result, NDJSON, and stream outcomes", () => {
    const result = createCliSessionSnapshot(
      snapshotContext({
        kind: "result",
        result: {
          tools: [{ name: "tool" }],
          resources: [{ uri: "file:///resource" }],
          resourceTemplates: [{ uriTemplate: "file:///{name}" }],
          prompts: [{ name: "prompt" }],
        },
      }),
    );
    expect(result.discovery).toMatchObject({
      tools: [{ name: "tool" }],
      resources: [{ uri: "file:///resource" }],
      resourceTemplates: [{ uriTemplate: "file:///{name}" }],
      prompts: [{ name: "prompt" }],
    });

    const ndjson = createCliSessionSnapshot(
      snapshotContext({
        kind: "ndjson",
        lines: [{ toolName: "one" }, undefined],
      }),
    );
    expect(ndjson.discovery?.tools).toEqual([{ toolName: "one" }, {}]);

    const stream = createCliSessionSnapshot(
      snapshotContext({ kind: "stream", label: "tail", start: () => () => {} }),
    );
    expect(stream.invocation).toMatchObject({
      outcome: { kind: "stream", label: "tail" },
    });
  });

  it("rejects circular, unparsable, and non-object snapshot values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      createCliSessionSnapshot(
        snapshotContext({ kind: "result", result: circular }),
      ),
    ).toThrow(/Cannot serialize method result/);

    const parse = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new SyntaxError("test parse failure");
    });
    expect(() =>
      createCliSessionSnapshot(snapshotContext({ kind: "result", result: {} })),
    ).toThrow(/Cannot parse serialized server source/);
    parse.mockRestore();

    expect(() =>
      createCliSessionSnapshot(
        snapshotContext({ kind: "ndjson", lines: [42] }),
      ),
    ).toThrow();
  });

  it("fails when the selected format handler cannot execute the plan", async () => {
    await expect(
      executeCliArtifactExport(
        {
          kind: "artifact",
          formatId: "missing.format",
          extensionId: "missing",
          artifactVersion: "1.0.0",
          operation: "export",
          encoding: "json",
          mediaType: "application/json",
          dataRequirements: {
            serverDescription: "none",
            session: "none",
          },
          options: {},
          output: { kind: "stdout" },
        },
        {},
      ),
    ).rejects.toThrow(/No handler is registered/);
  });
});
