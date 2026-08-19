import { describe, expect, it, vi } from "vitest";
import { createBuiltinContributionCatalog } from "@inspector/core/extensions/builtin/catalog.js";
import { INSPECTOR_SESSION_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/artifact.js";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  INSPECTOR_SESSION_MEDIA_TYPE,
} from "@inspector/core/extensions/api/sessions.js";
import {
  ArtifactFormatHandlerRegistry,
  executeArtifactExport,
  type ArtifactOutputSink,
  type ArtifactFormatHandler,
} from "@inspector/core/extensions/artifacts/service.js";
import type { ArtifactPlan } from "@inspector/core/extensions/artifacts/plan.js";
import type { ArtifactPayload } from "@inspector/core/extensions/api/artifacts.js";

const HOST = {
  inspectorVersion: "2.2.0",
  extensionApiVersion: "0.1.0",
} as const;

function plan(operation: ArtifactPlan["operation"] = "export"): ArtifactPlan {
  return {
    kind: "artifact",
    formatId: INSPECTOR_SESSION_FORMAT_ID,
    extensionId: "modelcontextprotocol.inspector-session",
    artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
    operation,
    encoding: "json",
    mediaType: INSPECTOR_SESSION_MEDIA_TYPE,
    options: {},
    output: { kind: "stdout" },
  };
}

function data() {
  return {
    inspectorVersion: "2.2.0",
    capturedAt: "2026-08-19T12:00:00.000Z",
    sessionId: "session-1",
  };
}

function payload(overrides: Partial<ArtifactPayload> = {}): ArtifactPayload {
  return {
    formatId: INSPECTOR_SESSION_FORMAT_ID,
    artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
    encoding: "json",
    mediaType: INSPECTOR_SESSION_MEDIA_TYPE,
    content: "{}",
    ...overrides,
  };
}

function setup() {
  const registry = new ArtifactFormatHandlerRegistry(
    createBuiltinContributionCatalog(HOST),
  );
  const write = vi.fn<ArtifactOutputSink["write"]>();
  return { registry, sink: { write }, write };
}

describe("ArtifactFormatHandlerRegistry", () => {
  it("registers and resolves a handler declared by the contribution catalog", () => {
    const { registry } = setup();
    registry.register(INSPECTOR_SESSION_ARTIFACT_PROVIDER);
    expect(registry.resolve(INSPECTOR_SESSION_FORMAT_ID)).toBe(
      INSPECTOR_SESSION_ARTIFACT_PROVIDER,
    );
    expect(registry.resolve("example.missing")).toBeUndefined();
  });

  it("rejects undeclared and duplicate handlers", () => {
    const { registry } = setup();
    expect(() =>
      registry.register({
        ...INSPECTOR_SESSION_ARTIFACT_PROVIDER,
        formatId: "example.missing",
      }),
    ).toThrow(/has no contribution/);

    registry.register(INSPECTOR_SESSION_ARTIFACT_PROVIDER);
    expect(() =>
      registry.register(INSPECTOR_SESSION_ARTIFACT_PROVIDER),
    ).toThrow(/already registered/);
  });
});

describe("executeArtifactExport", () => {
  it("exports through a registered handler and host-owned output", async () => {
    const { registry, sink, write } = setup();
    registry.register(INSPECTOR_SESSION_ARTIFACT_PROVIDER);

    const diagnostics = await executeArtifactExport(
      plan(),
      data(),
      registry,
      sink,
    );

    expect(diagnostics).toEqual([]);
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        formatId: INSPECTOR_SESSION_FORMAT_ID,
        content: expect.stringContaining('"sessionId": "session-1"'),
      }),
    );
  });

  it("rejects non-export plans and missing handlers before writing", async () => {
    const { registry, sink, write } = setup();

    await expect(
      executeArtifactExport(plan("validate"), data(), registry, sink),
    ).resolves.toEqual([
      expect.objectContaining({ code: "artifact.operation-unsupported" }),
    ]);
    await expect(
      executeArtifactExport(plan(), data(), registry, sink),
    ).resolves.toEqual([
      expect.objectContaining({ code: "artifact.handler-missing" }),
    ]);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not write when export returns no payload", async () => {
    const { registry, sink, write } = setup();
    const handler: ArtifactFormatHandler = {
      ...INSPECTOR_SESSION_ARTIFACT_PROVIDER,
      export: () => ({
        diagnostics: [
          {
            code: "artifact.export-failed",
            severity: "error",
            message: "No snapshot",
            path: [],
          },
        ],
      }),
    };
    registry.register(handler);

    await expect(
      executeArtifactExport(plan(), data(), registry, sink),
    ).resolves.toEqual([
      expect.objectContaining({ code: "artifact.export-failed" }),
    ]);
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects mismatched handler metadata before validation or output", async () => {
    const { registry, sink, write } = setup();
    const validate = vi.fn<ArtifactFormatHandler["validate"]>(() => []);
    registry.register({
      ...INSPECTOR_SESSION_ARTIFACT_PROVIDER,
      export: () => ({
        payload: payload({ artifactVersion: "9.0.0" }),
        diagnostics: [],
      }),
      validate,
    });

    await expect(
      executeArtifactExport(plan(), data(), registry, sink),
    ).resolves.toEqual([
      expect.objectContaining({ code: "artifact.payload-mismatch" }),
    ]);
    expect(validate).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("preserves handler diagnostics and blocks output on validation errors", async () => {
    const { registry, sink, write } = setup();
    registry.register({
      ...INSPECTOR_SESSION_ARTIFACT_PROVIDER,
      export: () => ({
        payload: payload(),
        diagnostics: [
          {
            code: "artifact.handler-note",
            severity: "warning",
            message: "Partial data",
            path: [],
          },
        ],
      }),
      validate: () => [
        {
          code: "artifact.validation-failed",
          severity: "error",
          message: "Invalid content",
          path: [],
        },
      ],
    });

    await expect(
      executeArtifactExport(plan(), data(), registry, sink),
    ).resolves.toEqual([
      expect.objectContaining({ code: "artifact.handler-note" }),
      expect.objectContaining({ code: "artifact.validation-failed" }),
    ]);
    expect(write).not.toHaveBeenCalled();
  });
});
