import { describe, expect, it } from "vitest";
import { buildMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/mapper.js";
import {
  MCPDESC_0_7_ARTIFACT_VERSION,
  MCPDESC_0_7_SCHEMA_URI,
} from "@inspector/core/extensions/builtin/mcpdesc-0.7/constants.js";
import { validateMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/validation.js";

function completeSnapshot() {
  return {
    capturedAt: "2026-08-20T12:00:00.000Z",
    protocolVersion: "2025-11-25",
    protocolEra: "modern",
    serverInfo: {
      name: "catalog-server",
      title: "Catalog Server",
      description: "Searches a product catalog",
      version: "2.4.0",
      websiteUrl: "https://example.com/catalog",
      icons: [
        {
          src: "https://example.com/icon.png",
          mimeType: "image/png",
          sizes: ["48x48"],
          theme: "light",
          sourceOnly: "excluded",
        },
      ],
      id: "source-only-id",
      contact: { email: "source@example.com" },
      sourceOnly: "excluded",
    },
    capabilities: {
      tools: { listChanged: true, vendorHint: "preserved" },
      resources: { subscribe: true, listChanged: false },
      prompts: { listChanged: true },
      completions: {},
      logging: {},
      tasks: { requests: { tools: { call: {} } } },
      experimental: { vendorFeature: { enabled: true } },
      vendorCapability: { mode: "extended" },
    },
    instructions: "Do not map instructions into info.description.",
    transport: {
      type: "streamable-http",
      url: "https://mcp.example.com/api",
    },
    tools: [
      {
        name: "catalog_search",
        title: "Catalog Search",
        description: "Search the catalog",
        inputSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: { query: { type: "string", customKeyword: true } },
          required: ["query"],
          additionalProperties: false,
        },
        outputSchema: {
          type: "object",
          properties: { count: { type: "number" } },
          vendorKeyword: "preserved",
        },
        annotations: {
          title: "Search",
          readOnlyHint: true,
          vendorAnnotation: { stable: true },
        },
        execution: {
          taskSupport: "optional",
          sourceOnlyExecutionField: "excluded",
        },
        icons: [
          {
            src: "data:image/png;base64,AA==",
            theme: "dark",
            sourceOnlyIconField: "excluded",
          },
        ],
        tags: ["catalog"],
        deprecated: false,
        _meta: { "vendor/tool": { trace: true } },
        sourceOnlyToolField: "excluded",
      },
    ],
    resources: [
      {
        uri: "catalog://items",
        name: "catalog-items",
        title: "Catalog Items",
        description: "All items",
        mimeType: "application/json",
        size: 128,
        annotations: { audience: ["user"], vendor: "preserved" },
        icons: [{ src: "https://example.com/resource.png" }],
        tags: ["catalog"],
        deprecated: false,
        _meta: { vendor: { revision: 3 } },
        sourceOnlyResourceField: "excluded",
      },
    ],
    resourceTemplates: [
      {
        uriTemplate: "catalog://items/{id}",
        name: "catalog-item",
        title: "Catalog Item",
        description: "One item",
        mimeType: "application/json",
        annotations: { priority: 0.8, vendor: true },
        icons: [{ src: "https://example.com/template.png" }],
        tags: ["catalog"],
        deprecated: false,
        _meta: { vendor: "preserved" },
        sourceOnlyTemplateField: "excluded",
      },
    ],
    prompts: [
      {
        name: "recommend",
        title: "Recommend",
        description: "Recommend an item",
        arguments: [
          {
            name: "category",
            title: "Category",
            description: "Desired category",
            required: true,
            sourceOnlyArgumentField: "excluded",
          },
        ],
        icons: [{ src: "https://example.com/prompt.png" }],
        tags: ["catalog"],
        deprecated: false,
        _meta: { vendor: ["preserved"] },
        sourceOnlyPromptField: "excluded",
      },
    ],
    diagnostics: [
      {
        code: "artifact.item-excluded-invalid",
        severity: "warning",
        message: "Tool at index 1 was invalid and was excluded",
        path: ["tools", 1],
      },
    ],
  };
}

describe("buildMcpDescription07Document", () => {
  it("maps a complete snapshot through the version-specific allowlist", () => {
    const result = buildMcpDescription07Document(completeSnapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a valid MCP description");

    expect(result.document).toMatchObject({
      $schema: MCPDESC_0_7_SCHEMA_URI,
      mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION,
      info: {
        name: "catalog-server",
        title: "Catalog Server",
        description: "Searches a product catalog",
        version: "2.4.0",
        protocolVersion: "2025-11-25",
        websiteUrl: "https://example.com/catalog",
        icons: [
          {
            src: "https://example.com/icon.png",
            mimeType: "image/png",
            sizes: ["48x48"],
            theme: "light",
          },
        ],
      },
      transports: [
        {
          type: "streamable-http",
          url: "https://mcp.example.com/api",
        },
      ],
      capabilities: {
        tools: { listChanged: true, vendorHint: "preserved" },
        experimental: { vendorFeature: { enabled: true } },
        vendorCapability: { mode: "extended" },
      },
      tools: [
        expect.objectContaining({
          name: "catalog_search",
          inputSchema: expect.objectContaining({
            additionalProperties: false,
          }),
          outputSchema: expect.objectContaining({
            vendorKeyword: "preserved",
          }),
          annotations: expect.objectContaining({
            vendorAnnotation: { stable: true },
          }),
          execution: { taskSupport: "optional" },
          _meta: { "vendor/tool": { trace: true } },
        }),
      ],
      resources: [expect.objectContaining({ name: "catalog-items" })],
      resourceTemplates: [expect.objectContaining({ name: "catalog-item" })],
      prompts: [
        expect.objectContaining({
          name: "recommend",
          arguments: [
            {
              name: "category",
              title: "Category",
              description: "Desired category",
              required: true,
            },
          ],
        }),
      ],
    });
    expect(result.document).not.toHaveProperty("instructions");
    expect(result.document).not.toHaveProperty("info.id");
    expect(result.document).not.toHaveProperty("info.contact");
    expect(result.document).not.toHaveProperty("info.sourceOnly");
    expect(result.document).not.toHaveProperty("info.icons.0.sourceOnly");
    expect(result.document).not.toHaveProperty("tools.0.sourceOnlyToolField");
    expect(result.document).not.toHaveProperty(
      "tools.0.execution.sourceOnlyExecutionField",
    );
    expect(result.document).not.toHaveProperty(
      "tools.0.icons.0.sourceOnlyIconField",
    );
    expect(result.document).not.toHaveProperty(
      "resources.0.sourceOnlyResourceField",
    );
    expect(result.document).not.toHaveProperty(
      "resourceTemplates.0.sourceOnlyTemplateField",
    );
    expect(result.document).not.toHaveProperty(
      "prompts.0.sourceOnlyPromptField",
    );
    expect(result.document).not.toHaveProperty(
      "prompts.0.arguments.0.sourceOnlyArgumentField",
    );
    expect(validateMcpDescription07Document(result.document)).toEqual([]);
    expect(result.diagnostics).toEqual([
      completeSnapshot().diagnostics[0],
      expect.objectContaining({
        code: "artifact.source-field-unsupported",
        path: ["instructions"],
      }),
    ]);
  });

  it("maps partial capabilities, one safe stdio transport, and omits empty lists", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      protocolVersion: undefined,
      protocolEra: "legacy",
      serverInfo: { name: "partial", version: "1.0.0" },
      capabilities: { resources: { subscribe: true } },
      instructions: undefined,
      transport: { type: "stdio", command: "node" },
      tools: [],
      resources: [{ uri: "file:///one", name: "one" }],
      resourceTemplates: [],
      prompts: [],
      diagnostics: [],
    });
    expect(result).toMatchObject({
      ok: true,
      document: {
        info: { name: "partial", version: "1.0.0" },
        transports: [{ type: "stdio", command: "node" }],
        capabilities: { resources: { subscribe: true } },
        resources: [{ uri: "file:///one", name: "one" }],
      },
      diagnostics: [],
    });
    if (!result.ok) throw new Error("Expected a partial description");
    expect(result.document).not.toHaveProperty("tools");
    expect(result.document).not.toHaveProperty("resourceTemplates");
    expect(result.document).not.toHaveProperty("prompts");

    const withoutArgsOrCapabilities = buildMcpDescription07Document({
      ...completeSnapshot(),
      serverInfo: { name: "minimal", version: "1.0.0" },
      capabilities: {},
      instructions: undefined,
      transport: { type: "stdio", command: "server" },
      tools: [{ name: "ping" }],
      resources: [],
      resourceTemplates: [],
      prompts: [],
      diagnostics: [],
    });
    expect(withoutArgsOrCapabilities).toMatchObject({
      ok: true,
      document: { transports: [{ type: "stdio", command: "server" }] },
    });
    if (!withoutArgsOrCapabilities.ok) {
      throw new Error("Expected a minimal description");
    }
    expect(withoutArgsOrCapabilities.document).not.toHaveProperty(
      "capabilities",
    );
    expect(withoutArgsOrCapabilities.document).not.toHaveProperty(
      "transports.0.args",
    );
  });

  it("fails when required initialize metadata is missing", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      serverInfo: { title: "Missing identity" },
      instructions: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "name"],
        }),
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "version"],
        }),
      ]),
    );
  });

  it("fails when the negotiated protocol version is unsupported by 0.7", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      protocolVersion: "2026-01-01",
      instructions: undefined,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "protocolVersion"],
        }),
      ]),
    );
  });

  it("fails before mapping malformed snapshots", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      capturedAt: "invalid",
    });
    expect(result).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "artifact.snapshot-invalid",
          path: ["capturedAt"],
        }),
      ],
    });
  });

  it("fails when no non-empty discovered surface can satisfy the schema", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      instructions: undefined,
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: [],
    });
    expect(result).toEqual({
      ok: false,
      diagnostics: [
        completeSnapshot().diagnostics[0],
        expect.objectContaining({ code: "artifact.no-discovered-surface" }),
      ],
    });
  });

  it("lets AJV reject invalid values in allowlisted strict structures", () => {
    const result = buildMcpDescription07Document({
      ...completeSnapshot(),
      instructions: undefined,
      tools: [
        {
          name: "invalid-optionals",
          execution: "future-shape",
          icons: ["not-an-icon"],
        },
      ],
      prompts: [
        {
          name: "invalid-prompt",
          arguments: ["not-an-argument"],
          icons: "not-an-array",
        },
      ],
      resources: [],
      resourceTemplates: [],
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "artifact.schema-invalid" }),
      ]),
    );
  });
});
