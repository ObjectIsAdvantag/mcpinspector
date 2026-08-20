import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorClient } from "@inspector/core/mcp/inspectorClient.js";
import { createTransportNode } from "@inspector/core/mcp/node/transport.js";
import { eraToVersionNegotiation } from "@inspector/core/mcp/types.js";
import { ExtensionJsonObjectSchema } from "@inspector/core/extensions/api/json.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import { validateMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/validation.js";
import { collectServerDescriptionSnapshot } from "@inspector/core/extensions/builtin/serverDescriptionSnapshot.js";
import {
  createEchoTool,
  createInvalidHeaderTool,
  createNumberedPrompts,
  createNumberedResources,
  createNumberedResourceTemplates,
  createNumberedTools,
  createTestServerHttp,
  createTestServerInfo,
  type ServerConfig,
  type TestServerHttp,
} from "@modelcontextprotocol/inspector-test-server";

const CAPTURED_AT = "2026-08-20T12:00:00.000Z";

describe("MCP Description 0.7 live collection and export", () => {
  let client: InspectorClient | null = null;
  let server: TestServerHttp | null = null;

  afterEach(async () => {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Best-effort test cleanup.
      }
      client = null;
    }
    if (server) {
      try {
        await server.stop();
      } catch {
        // Best-effort test cleanup.
      }
      server = null;
    }
  });

  async function connect(
    config: ServerConfig,
    era: "legacy" | "modern" = "legacy",
  ): Promise<{ connected: InspectorClient; url: string }> {
    const started = createTestServerHttp(config);
    await started.start();
    server = started;

    const connected = new InspectorClient(
      { type: "streamable-http", url: started.url },
      {
        environment: { transport: createTransportNode },
        versionNegotiation: eraToVersionNegotiation(era),
      },
    );
    await connected.connect();
    client = connected;
    return { connected, url: started.url };
  }

  async function collectAndExport(
    connected: InspectorClient,
    url: string,
  ): Promise<{
    snapshot: Awaited<ReturnType<typeof collectServerDescriptionSnapshot>>;
    document: unknown;
  }> {
    const snapshot = await collectServerDescriptionSnapshot({
      client: connected,
      serverConfig: { type: "streamable-http", url },
      capturedAt: CAPTURED_AT,
    });
    const result = MCPDESC_0_7_ARTIFACT_PROVIDER.export(
      ExtensionJsonObjectSchema.parse(snapshot),
      {},
      "json",
    );
    if (result.payload === undefined) {
      throw new Error(
        `Expected a live MCP Description payload: ${JSON.stringify(result.diagnostics)}`,
      );
    }
    expect(MCPDESC_0_7_ARTIFACT_PROVIDER.validate(result.payload)).toEqual([]);
    const document: unknown = JSON.parse(result.payload.content);
    expect(validateMcpDescription07Document(document)).toEqual([]);
    return { snapshot, document };
  }

  it("collects every page from a complete server before exporting", async () => {
    const { connected, url } = await connect({
      serverInfo: createTestServerInfo("complete-paginated", "1.0.0"),
      tools: createNumberedTools(3),
      resources: createNumberedResources(3),
      resourceTemplates: createNumberedResourceTemplates(3),
      prompts: createNumberedPrompts(3),
      maxPageSize: {
        tools: 1,
        resources: 1,
        resourceTemplates: 1,
        prompts: 1,
      },
    });

    const { snapshot, document } = await collectAndExport(connected, url);
    expect(snapshot.tools).toHaveLength(3);
    expect(snapshot.resources).toHaveLength(3);
    expect(snapshot.resourceTemplates).toHaveLength(3);
    expect(snapshot.prompts).toHaveLength(3);
    expect(document).toMatchObject({
      tools: [{ name: "tool_1" }, { name: "tool_2" }, { name: "tool_3" }],
      resources: [
        { name: "resource_1" },
        { name: "resource_2" },
        { name: "resource_3" },
      ],
      resourceTemplates: [
        { name: "template_1" },
        { name: "template_2" },
        { name: "template_3" },
      ],
      prompts: [
        { name: "prompt_1" },
        { name: "prompt_2" },
        { name: "prompt_3" },
      ],
    });
  });

  it("does not request unadvertised surfaces from a partial-capability server", async () => {
    const { connected, url } = await connect({
      serverInfo: createTestServerInfo("tools-only", "1.0.0"),
      tools: [createEchoTool()],
    });

    const { snapshot, document } = await collectAndExport(connected, url);
    expect(snapshot.tools).toHaveLength(1);
    expect(snapshot.resources).toEqual([]);
    expect(snapshot.resourceTemplates).toEqual([]);
    expect(snapshot.prompts).toEqual([]);
    expect(document).toMatchObject({ tools: [{ name: "echo" }] });
    expect(document).not.toHaveProperty("resources");
    expect(document).not.toHaveProperty("resourceTemplates");
    expect(document).not.toHaveProperty("prompts");
  });

  it("diagnoses and omits invalid tools from a modern paginated server", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { connected, url } = await connect(
        {
          serverInfo: createTestServerInfo("invalid-tool", "1.0.0"),
          tools: [createEchoTool(), createInvalidHeaderTool()],
          modern: {},
          maxPageSize: { tools: 1 },
        },
        "modern",
      );

      const snapshot = await collectServerDescriptionSnapshot({
        client: connected,
        serverConfig: { type: "streamable-http", url },
        capturedAt: CAPTURED_AT,
      });
      expect(snapshot.tools.map(({ name }) => name)).toEqual(["echo"]);
      expect(JSON.stringify(snapshot.tools)).not.toContain(
        "invalid_header_tool",
      );
      expect(snapshot.diagnostics).toEqual([
        expect.objectContaining({
          code: "artifact.tool-excluded",
          message: expect.stringContaining("invalid_header_tool"),
        }),
      ]);

      const result = MCPDESC_0_7_ARTIFACT_PROVIDER.export(
        ExtensionJsonObjectSchema.parse(snapshot),
        {},
        "json",
      );
      expect(result.payload).toBeUndefined();
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "artifact.tool-excluded" }),
          expect.objectContaining({
            code: "artifact.schema-invalid",
            path: ["info", "protocolVersion"],
          }),
        ]),
      );
    } finally {
      consoleWarn.mockRestore();
    }
  });
});
