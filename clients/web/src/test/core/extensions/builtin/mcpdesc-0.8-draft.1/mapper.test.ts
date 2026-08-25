import { describe, expect, it } from "vitest";
import { supportedProtocolVersions } from "@mcpdesc/validator";
import {
  MCPDESC_0_8_DRAFT_1_DOCUMENT_VERSION,
  MCPDESC_0_8_DRAFT_1_SCHEMA_URI,
} from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/constants.js";
import { buildMcpDescription08Draft1Document } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/mapper.js";
import { validateMcpDescription08Draft1Document } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/validation.js";

function snapshot(protocolVersion: string) {
  return {
    capturedAt: "2026-08-25T12:00:00.000Z",
    protocolVersion,
    protocolEra: "modern" as const,
    serverInfo: { name: "draft-server", version: "1.0.0" },
    transport: { type: "stdio" as const, command: "node" },
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    diagnostics: [],
  };
}

describe("buildMcpDescription08Draft1Document", () => {
  it.each(supportedProtocolVersions)(
    "builds a single effective view for MCP %s",
    (protocolVersion) => {
      const result = buildMcpDescription08Draft1Document(
        snapshot(protocolVersion),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected a valid Draft 1 description");
      expect(result.document).toEqual({
        $schema: MCPDESC_0_8_DRAFT_1_SCHEMA_URI,
        mcpdesc: MCPDESC_0_8_DRAFT_1_DOCUMENT_VERSION,
        info: { name: "draft-server", version: "1.0.0" },
        protocolVersions: [protocolVersion],
        transports: [{ type: "stdio", command: "node" }],
      });
      expect(
        validateMcpDescription08Draft1Document(result.document).some(
          (diagnostic) => diagnostic.severity === "error",
        ),
      ).toBe(false);
    },
  );

  it("maps instructions, capabilities, primitive fields, and safe transport data", () => {
    const result = buildMcpDescription08Draft1Document({
      ...snapshot("2025-11-25"),
      serverInfo: {
        name: "catalog-server",
        title: "Catalog Server",
        description: "Searches a product catalog",
        version: "2.4.0",
        websiteUrl: "https://example.com/catalog",
        icons: [
          {
            src: "https://example.com/icon.png",
            sourceOnly: "excluded",
          },
        ],
        sourceOnly: "excluded",
      },
      instructions: "Use catalog_search for product discovery.",
      capabilities: { tools: { listChanged: true } },
      transport: {
        type: "streamable-http",
        url: "https://mcp.example.com/api",
      },
      tools: [
        {
          name: "catalog_search",
          title: "Catalog Search",
          inputSchema: { type: "object", properties: {} },
          execution: { taskSupport: "optional", sourceOnly: true },
          icons: [{ src: "https://example.com/tool.png", sourceOnly: true }],
          sourceOnly: true,
        },
      ],
      resources: [
        {
          uri: "catalog://items",
          name: "items",
          annotations: { priority: 0.8 },
          sourceOnly: true,
        },
      ],
      resourceTemplates: [
        {
          uriTemplate: "catalog://items/{id}",
          name: "item",
          sourceOnly: true,
        },
      ],
      prompts: [
        {
          name: "recommend",
          arguments: [{ name: "category", required: true, sourceOnly: true }],
          sourceOnly: true,
        },
      ],
      diagnostics: [
        {
          code: "artifact.item-excluded-invalid",
          severity: "warning",
          message: "One source item was excluded",
          path: ["tools", 1],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a valid Draft 1 description");
    expect(result.document).toMatchObject({
      mcpdesc: "0.8.0",
      protocolVersions: ["2025-11-25"],
      instructions: "Use catalog_search for product discovery.",
      capabilities: [{ tools: { listChanged: true } }],
      transports: [
        { type: "streamable-http", url: "https://mcp.example.com/api" },
      ],
      tools: [
        {
          name: "catalog_search",
          execution: { taskSupport: "optional" },
          icons: [{ src: "https://example.com/tool.png" }],
        },
      ],
      resources: [{ uri: "catalog://items", name: "items" }],
      resourceTemplates: [
        { uriTemplate: "catalog://items/{id}", name: "item" },
      ],
      prompts: [
        {
          name: "recommend",
          arguments: [{ name: "category", required: true }],
        },
      ],
    });
    expect(result.document).not.toHaveProperty("info.sourceOnly");
    expect(result.document).not.toHaveProperty("info.icons.0.sourceOnly");
    expect(result.document).not.toHaveProperty("tools.0.sourceOnly");
    expect(result.document).not.toHaveProperty("tools.0.execution.sourceOnly");
    expect(result.document).not.toHaveProperty("tools.0.icons.0.sourceOnly");
    expect(result.document).not.toHaveProperty("resources.0.sourceOnly");
    expect(result.document).not.toHaveProperty(
      "resourceTemplates.0.sourceOnly",
    );
    expect(result.document).not.toHaveProperty("prompts.0.sourceOnly");
    expect(result.document).not.toHaveProperty(
      "prompts.0.arguments.0.sourceOnly",
    );
    expect(result.diagnostics[0]).toMatchObject({
      code: "artifact.item-excluded-invalid",
    });
  });

  it("returns snapshot and validator diagnostics with structured paths", () => {
    expect(buildMcpDescription08Draft1Document(null)).toMatchObject({
      ok: false,
      diagnostics: [
        { code: "artifact.snapshot-invalid", severity: "error", path: [] },
      ],
    });

    const result = buildMcpDescription08Draft1Document({
      ...snapshot("unknown-version"),
      protocolVersion: undefined,
      serverInfo: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "schema-validation",
          severity: "error",
          path: ["info", "name"],
        }),
        expect.objectContaining({
          severity: "error",
          path: ["protocolVersions"],
        }),
      ]),
    );
  });
});
