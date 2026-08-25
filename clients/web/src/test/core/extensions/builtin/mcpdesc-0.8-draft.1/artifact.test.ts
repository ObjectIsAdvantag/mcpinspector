import { describe, expect, it } from "vitest";
import { MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/artifact.js";
import {
  MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
  MCPDESC_0_8_DRAFT_1_FORMAT_ID,
  MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
  MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE,
  isMcpDescription08Draft1Encoding,
  mcpDescription08Draft1MediaType,
} from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/constants.js";
import { parseMcpDescription08Draft1 } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/encoding.js";

const snapshot = {
  capturedAt: "2026-08-25T12:00:00.000Z",
  protocolVersion: "2026-07-28",
  protocolEra: "modern" as const,
  serverInfo: { name: "draft-server", version: "1.0.0" },
  transport: { type: "stdio" as const, command: "node" },
  tools: [],
  resources: [],
  resourceTemplates: [],
  prompts: [],
  diagnostics: [],
};

describe("MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER", () => {
  it.each([
    ["json", MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE],
    ["yaml", MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE],
  ] as const)("exports and validates %s", (encoding, mediaType) => {
    const result = MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.export(
      snapshot,
      {},
      encoding,
    );

    expect(result.payload).toMatchObject({
      formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
      artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
      encoding,
      mediaType,
    });
    expect(result.diagnostics).toEqual([]);
    if (result.payload === undefined) throw new Error("Expected a payload");
    expect(
      parseMcpDescription08Draft1(result.payload.content, encoding),
    ).toMatchObject({
      mcpdesc: "0.8.0",
      protocolVersions: ["2026-07-28"],
    });
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.validate(result.payload),
    ).toEqual([]);
  });

  it("pairs supported encodings with their media types", () => {
    expect(isMcpDescription08Draft1Encoding("json")).toBe(true);
    expect(isMcpDescription08Draft1Encoding("yaml")).toBe(true);
    expect(isMcpDescription08Draft1Encoding("toml")).toBe(false);
    expect(mcpDescription08Draft1MediaType("json")).toBe(
      MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
    );
    expect(mcpDescription08Draft1MediaType("yaml")).toBe(
      MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE,
    );
  });

  it("rejects unsupported export encodings and invalid snapshots", () => {
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.export(snapshot, {}, "toml"),
    ).toMatchObject({
      diagnostics: [{ code: "artifact.encoding-unsupported" }],
    });
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.export({}, {}, "json"),
    ).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "artifact.snapshot-invalid" }),
      ]),
    });
  });

  it("rejects invalid metadata and malformed JSON or YAML", () => {
    const payload = {
      formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
      artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
      encoding: "json",
      mediaType: MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
      content: "{}",
    };
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.validate({
        ...payload,
        formatId: "wrong-format",
      }),
    ).toMatchObject([{ code: "artifact.payload-invalid" }]);
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.validate({
        ...payload,
        content: "{",
      }),
    ).toMatchObject([{ code: "artifact.invalid-json" }]);
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.validate({
        ...payload,
        encoding: "yaml",
        mediaType: MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE,
        content: "[unterminated",
      }),
    ).toMatchObject([{ code: "artifact.invalid-yaml" }]);
  });

  it("returns structured validation diagnostics for parsed content", () => {
    expect(
      MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER.validate({
        formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
        artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
        encoding: "json",
        mediaType: MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
        content: JSON.stringify({ mcpdesc: "0.8.0" }),
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "schema-validation",
          severity: "error",
          path: ["info"],
        }),
      ]),
    );
  });
});
