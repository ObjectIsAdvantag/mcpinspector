import { describe, expect, it } from "vitest";
import type { ArtifactPayload } from "@inspector/core/extensions/api/artifacts.js";
import { ExtensionJsonObjectSchema } from "@inspector/core/extensions/api/json.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import {
  MCPDESC_0_7_ARTIFACT_VERSION,
  MCPDESC_0_7_FORMAT_ID,
  MCPDESC_0_7_JSON_MEDIA_TYPE,
  MCPDESC_0_7_SCHEMA_URI,
  MCPDESC_0_7_YAML_MEDIA_TYPE,
} from "@inspector/core/extensions/builtin/mcpdesc-0.7/constants.js";
import { parseMcpDescription07 } from "@inspector/core/extensions/builtin/mcpdesc-0.7/encoding.js";
import { MCPDESC_0_7_JSON_SCHEMA } from "@inspector/core/extensions/builtin/mcpdesc-0.7/schema.js";
import { validateMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/validation.js";

const SOURCE_DIAGNOSTIC = {
  code: "artifact.item-excluded-invalid",
  severity: "warning",
  message: "An invalid tool was excluded by the host",
  path: ["tools", 1],
} as const;

function snapshotData() {
  return ExtensionJsonObjectSchema.parse({
    capturedAt: "2026-08-20T14:00:00.000Z",
    protocolVersion: "2025-06-18",
    protocolEra: "modern",
    serverInfo: {
      name: "artifact-server",
      version: "1.2.3",
      description: "Artifact fixture",
    },
    capabilities: { tools: { listChanged: true } },
    transport: { type: "sse", url: "https://example.com/sse" },
    tools: [{ name: "valid-tool", inputSchema: { type: "object" } }],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    diagnostics: [SOURCE_DIAGNOSTIC],
  });
}

function validDocument() {
  return {
    $schema: MCPDESC_0_7_SCHEMA_URI,
    mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION,
    info: {
      name: "artifact-server",
      version: "1.2.3",
      websiteUrl: "https://example.com/artifact-server",
    },
    transports: [{ type: "sse", url: "https://example.com/sse" }],
    tools: [{ name: "valid-tool" }],
  };
}

function payload(overrides: Partial<ArtifactPayload> = {}): ArtifactPayload {
  return {
    formatId: MCPDESC_0_7_FORMAT_ID,
    artifactVersion: MCPDESC_0_7_ARTIFACT_VERSION,
    encoding: "json",
    mediaType: MCPDESC_0_7_JSON_MEDIA_TYPE,
    content: JSON.stringify(validDocument()),
    ...overrides,
  };
}

describe("MCP Description 0.7 codecs and artifact handler", () => {
  it.each([
    ["json", MCPDESC_0_7_JSON_MEDIA_TYPE],
    ["yaml", MCPDESC_0_7_YAML_MEDIA_TYPE],
  ] as const)(
    "exports and validates %s with its deterministic media type",
    (encoding, mediaType) => {
      const result = MCPDESC_0_7_ARTIFACT_PROVIDER.export(
        snapshotData(),
        {},
        encoding,
      );
      expect(result.payload).toMatchObject({
        formatId: MCPDESC_0_7_FORMAT_ID,
        artifactVersion: MCPDESC_0_7_ARTIFACT_VERSION,
        encoding,
        mediaType,
      });
      expect(result.diagnostics).toEqual([SOURCE_DIAGNOSTIC]);
      if (result.payload === undefined) {
        throw new Error("Expected an encoded artifact payload");
      }
      const parsed = parseMcpDescription07(result.payload.content, encoding);
      expect(parsed).toMatchObject({
        $schema: MCPDESC_0_7_SCHEMA_URI,
        mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION,
        info: { name: "artifact-server", version: "1.2.3" },
        tools: [{ name: "valid-tool" }],
      });
      expect(MCPDESC_0_7_ARTIFACT_PROVIDER.validate(result.payload)).toEqual(
        [],
      );
    },
  );

  it("defaults direct handler exports to JSON", () => {
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.export(snapshotData(), {}).payload,
    ).toMatchObject({
      encoding: "json",
      mediaType: MCPDESC_0_7_JSON_MEDIA_TYPE,
    });
  });

  it("rejects unsupported export encodings and mapping failures", () => {
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.export(snapshotData(), {}, "toml"),
    ).toEqual({
      diagnostics: [
        expect.objectContaining({ code: "artifact.encoding-unsupported" }),
      ],
    });
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.export(
        ExtensionJsonObjectSchema.parse({
          ...snapshotData(),
          tools: [],
        }),
        {},
        "json",
      ),
    ).toEqual({
      ok: false,
      diagnostics: expect.arrayContaining([
        SOURCE_DIAGNOSTIC,
        expect.objectContaining({
          code: "artifact.no-discovered-surface",
        }),
      ]),
    });
  });

  it.each([
    { formatId: "example.wrong" },
    { artifactVersion: "0.8.0" },
    { encoding: "toml" },
    { mediaType: "application/json" },
  ])("rejects payload metadata mismatch %#", (override) => {
    expect(MCPDESC_0_7_ARTIFACT_PROVIDER.validate(payload(override))).toEqual([
      expect.objectContaining({ code: "artifact.payload-invalid" }),
    ]);
  });

  it("reports invalid JSON and YAML syntax", () => {
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.validate(payload({ content: "{" })),
    ).toEqual([expect.objectContaining({ code: "artifact.invalid-json" })]);
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.validate(
        payload({
          encoding: "yaml",
          mediaType: MCPDESC_0_7_YAML_MEDIA_TYPE,
          content: "tools: [unterminated",
        }),
      ),
    ).toEqual([expect.objectContaining({ code: "artifact.invalid-yaml" })]);
  });

  it("rejects structurally invalid JSON and YAML documents", () => {
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.validate(
        payload({ content: JSON.stringify({ ...validDocument(), info: {} }) }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "name"],
        }),
      ]),
    );
    expect(
      MCPDESC_0_7_ARTIFACT_PROVIDER.validate(
        payload({
          encoding: "yaml",
          mediaType: MCPDESC_0_7_YAML_MEDIA_TYPE,
          content: [
            "mcpdesc: 0.7.0",
            "info:",
            "  name: fixture",
            "  version: 1.0.0",
            "transports:",
            "  - type: stdio",
            "    command: fixture",
            "tools:",
            "  - name: fixture",
            "unexpected: true",
          ].join("\n"),
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["unexpected"],
        }),
      ]),
    );
  });
});

describe("authoritative MCP Description 0.7 schema validation", () => {
  it("exposes the authoritative schema identity", () => {
    expect(MCPDESC_0_7_JSON_SCHEMA).toMatchObject({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: MCPDESC_0_7_SCHEMA_URI,
      additionalProperties: false,
    });
    expect(validateMcpDescription07Document(validDocument())).toEqual([]);
  });

  it("enforces the authoritative URI and email formats", () => {
    expect(
      validateMcpDescription07Document({
        ...validDocument(),
        info: {
          ...validDocument().info,
          websiteUrl: "not-a-uri",
          contact: { email: "not-an-email" },
        },
        transports: [{ type: "sse", url: "also-not-a-uri" }],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "websiteUrl"],
        }),
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["info", "contact", "email"],
        }),
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["transports", 0, "url"],
        }),
      ]),
    );
  });

  it("keeps structural and array-path validation strong", () => {
    expect(
      validateMcpDescription07Document({
        ...validDocument(),
        tools: [{ description: "missing name" }],
        "x-valid-extension": { future: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.schema-invalid",
          path: ["tools", 0, "name"],
        }),
      ]),
    );
    expect(
      validateMcpDescription07Document({
        ...validDocument(),
        invalidRootField: true,
      }),
    ).toEqual([
      expect.objectContaining({
        code: "artifact.schema-invalid",
        path: ["invalidRootField"],
      }),
    ]);
  });
});
