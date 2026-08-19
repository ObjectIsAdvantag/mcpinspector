import { describe, expect, it } from "vitest";
import { INSPECTOR_SESSION_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/provider.js";
import {
  buildNativeSessionArtifact,
  SESSION_REDACTED_VALUE,
} from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  INSPECTOR_SESSION_MEDIA_TYPE,
  parseNativeSessionArtifact,
  serializeNativeSessionArtifact,
} from "@inspector/core/extensions/api/sessions.js";
import type { ExtensionJsonObject } from "@inspector/core/extensions/api/json.js";
import { artifactDiagnosticPath } from "@inspector/core/extensions/api/artifacts.js";

const SECRET = "secret-canary-7f83";

function snapshotInput(): ExtensionJsonObject {
  return {
    inspectorVersion: "2.2.0",
    capturedAt: "2026-08-19T10:15:00.000Z",
    sessionId: "session-1",
    server: {
      source: {
        type: "streamable-http",
        url: `https://example.test/mcp?token=${SECRET}&api_key=${SECRET}&page=1#section`,
        headers: {
          Authorization: `Bearer ${SECRET}`,
          "X-Trace": "visible",
        },
        metadata: [
          { key: "x-api-key", value: SECRET },
          { key: "safe", value: "visible-metadata" },
        ],
        oauth: { client_secret: SECRET },
      },
      protocolVersion: "2025-06-18",
      protocolEra: "legacy",
    },
    discovery: {
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
      futureDiscoveryField: "preserved",
    },
    events: {
      protocol: [
        {
          timestamp: "2026-08-19T10:15:01.000Z",
          message: {
            jsonrpc: "2.0",
            method: "tools/list",
            token: SECRET,
            error: { code: -32020 },
            password: [SECRET],
          },
        },
      ],
      network: [
        {
          url: `https://example.test/token?code=${SECRET}`,
          requestBody: JSON.stringify({ refresh_token: SECRET, safe: true }),
          responseBody: `client_secret=${SECRET}&safe=true`,
        },
      ],
    },
    futureTopLevelField: { preserved: true },
  };
}

function buildArtifact() {
  const result = buildNativeSessionArtifact(snapshotInput());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected a valid native session artifact");
  return result.artifact;
}

describe("buildNativeSessionArtifact", () => {
  it("builds a complete v1 document and fills absent collection sections", () => {
    const artifact = buildArtifact();

    expect(artifact.header.format).toEqual({
      id: INSPECTOR_SESSION_FORMAT_ID,
      version: INSPECTOR_SESSION_ARTIFACT_VERSION,
    });
    expect(artifact.discovery).toMatchObject({
      resources: [],
      resourceTemplates: [],
      prompts: [],
      futureDiscoveryField: "preserved",
    });
    expect(artifact.events).toMatchObject({
      stderr: [],
      console: [],
      tasks: [],
      subscriptions: [],
      auth: [],
    });
    expect(artifact.attachments).toEqual([]);
    expect(artifact.futureTopLevelField).toEqual({ preserved: true });
    expect(artifact.inspectorVersion).toBeUndefined();
    expect(artifact.capturedAt).toBeUndefined();
    expect(artifact.sessionId).toBeUndefined();
  });

  it("redacts sensitive keys, URL parameters, headers, and JSON bodies", () => {
    const artifact = buildArtifact();
    const serialized = JSON.stringify(artifact);

    expect(serialized).not.toContain(SECRET);
    expect(serialized).toContain(SESSION_REDACTED_VALUE);
    expect(serialized).toContain("X-Trace");
    expect(serialized).toContain("visible");
    expect(serialized).toContain("visible-metadata");
    expect(serialized).toContain("-32020");
    expect(serialized).toContain("page=1");
    expect(serialized).toContain("safe=true");
    expect(serialized).toContain("#section");
    expect(artifact.diagnostics.length).toBeGreaterThanOrEqual(5);
    expect(artifact.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.value-redacted",
          path: ["server", "source", "headers", "Authorization"],
        }),
        expect.objectContaining({
          path: ["events", "network", 0, "requestBody", "refresh_token"],
        }),
      ]),
    );
  });

  it("rejects invalid snapshot adapter input", () => {
    const result = buildNativeSessionArtifact({ sessionId: "missing-fields" });
    expect(result).toEqual({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.snapshot-invalid",
          severity: "error",
        }),
      ]),
    });
  });

  it("rejects malformed attachment adapter data", () => {
    const result = buildNativeSessionArtifact({
      ...snapshotInput(),
      attachments: [{}],
    });
    expect(result).toEqual({
      ok: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "artifact.snapshot-invalid",
          path: expect.arrayContaining(["attachments", 0]),
        }),
      ]),
    });
  });
});

describe("native session parsing", () => {
  it("normalizes symbol-capable validator paths for JSON diagnostics", () => {
    expect(artifactDiagnosticPath([Symbol("field"), "child", 1])).toEqual([
      "Symbol(field)",
      "child",
      1,
    ]);
  });

  it("round-trips supported and unknown same-version fields", () => {
    const artifact = buildArtifact();
    const serialized = serializeNativeSessionArtifact(artifact);
    const parsed = parseNativeSessionArtifact(serialized);

    expect(parsed).toEqual({ ok: true, artifact });
  });

  it("rejects corrupt, oversized, wrong-format, and future-version input", () => {
    expect(parseNativeSessionArtifact("{")).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "artifact.invalid-json" }),
        ],
      }),
    );
    expect(parseNativeSessionArtifact("{}", 1)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "artifact.too-large" })],
      }),
    );

    const artifact = buildArtifact();
    const wrongFormat: unknown = {
      ...artifact,
      header: {
        ...artifact.header,
        format: { ...artifact.header.format, id: "example.other-format" },
      },
    };
    expect(parseNativeSessionArtifact(wrongFormat)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "artifact.format-unsupported" }),
        ],
      }),
    );

    const future: unknown = {
      ...artifact,
      header: {
        ...artifact.header,
        format: { ...artifact.header.format, version: "2.0.0" },
      },
    };
    expect(parseNativeSessionArtifact(future)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "artifact.version-unsupported" }),
        ],
      }),
    );
  });

  it("reports schema paths without performing external work", () => {
    const result = parseNativeSessionArtifact({ header: {} });
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "artifact.schema-invalid",
            path: expect.arrayContaining(["header"]),
          }),
        ]),
      }),
    );
  });
});

describe("INSPECTOR_SESSION_PROVIDER", () => {
  it("exports and validates native JSON payloads", () => {
    const result = INSPECTOR_SESSION_PROVIDER.export(snapshotInput(), {});
    expect(result).not.toBeInstanceOf(Promise);
    if (result instanceof Promise || result.payload === undefined) {
      throw new Error("Expected a synchronous artifact payload");
    }

    expect(result.payload).toMatchObject({
      formatId: INSPECTOR_SESSION_FORMAT_ID,
      artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
      encoding: "json",
      mediaType: INSPECTOR_SESSION_MEDIA_TYPE,
    });
    expect(INSPECTOR_SESSION_PROVIDER.validate(result.payload)).toEqual([]);
  });

  it("rejects invalid snapshot input and payload metadata/content", () => {
    const invalidExport = INSPECTOR_SESSION_PROVIDER.export({}, {});
    if (invalidExport instanceof Promise) {
      throw new Error("Expected a synchronous artifact result");
    }
    expect(invalidExport.payload).toBeUndefined();
    const validPayload = {
      formatId: INSPECTOR_SESSION_FORMAT_ID,
      artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
      encoding: "json",
      mediaType: INSPECTOR_SESSION_MEDIA_TYPE,
      content: "{}",
    };
    expect(
      INSPECTOR_SESSION_PROVIDER.validate({
        ...validPayload,
        mediaType: "application/json",
      }),
    ).toEqual([expect.objectContaining({ code: "artifact.payload-invalid" })]);
    expect(INSPECTOR_SESSION_PROVIDER.validate(validPayload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "artifact.schema-invalid" }),
      ]),
    );
  });
});
