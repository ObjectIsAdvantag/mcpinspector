import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { ServerDescriptionSnapshot } from "@inspector/core/extensions/api/serverDescription.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import { validateMcpDescription07Document } from "@inspector/core/extensions/builtin/mcpdesc-0.7/validation.js";
import { validateMcpDescription08Draft1Document } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/validation.js";
import { exportWebServerDescriptionArtifact } from "./exportServerDescriptionArtifact";

const snapshot: ServerDescriptionSnapshot = {
  capturedAt: "2026-08-20T12:00:00.000Z",
  protocolVersion: "2025-11-25",
  protocolEra: "legacy",
  serverInfo: { name: "demo", version: "1.0.0" },
  capabilities: { tools: {} },
  transport: { type: "stdio", command: "demo" },
  tools: [{ name: "ping", inputSchema: { type: "object" } }],
  resources: [],
  resourceTemplates: [],
  prompts: [],
  diagnostics: [
    {
      code: "artifact.tool-excluded",
      severity: "warning",
      message: "One invalid tool was excluded",
      path: ["tools", 1],
    },
  ],
};

describe("exportWebServerDescriptionArtifact", () => {
  it.each(["json", "yaml"] as const)(
    "exports and validates %s",
    async (encoding) => {
      const result = await exportWebServerDescriptionArtifact(
        snapshot,
        "mcpdesc-0.7",
        encoding,
      );
      const document: unknown =
        encoding === "json"
          ? JSON.parse(result.content)
          : parse(result.content);

      expect(validateMcpDescription07Document(document)).toEqual([]);
      expect(document).toMatchObject({
        mcpdesc: "0.7.0",
        info: { name: "demo", version: "1.0.0" },
        tools: [{ name: "ping" }],
      });
      expect(result.mediaType).toContain(encoding);
      expect(result.diagnostics).toEqual(snapshot.diagnostics);
    },
  );

  it.each(["json", "yaml"] as const)(
    "exports and validates Draft 1 %s",
    async (encoding) => {
      const result = await exportWebServerDescriptionArtifact(
        snapshot,
        "mcpdesc-0.8-draft.1",
        encoding,
      );
      const document: unknown =
        encoding === "json"
          ? JSON.parse(result.content)
          : parse(result.content);

      expect(
        validateMcpDescription08Draft1Document(document).some(
          ({ severity }) => severity === "error",
        ),
      ).toBe(false);
      expect(document).toMatchObject({
        mcpdesc: "0.8.0",
        protocolVersions: ["2025-11-25"],
        capabilities: [{ tools: {} }],
      });
      expect(result.mediaType).toContain(encoding);
      expect(result.diagnostics).toEqual(snapshot.diagnostics);
    },
  );

  it("rejects missing payloads and validation errors", async () => {
    vi.spyOn(MCPDESC_0_7_ARTIFACT_PROVIDER, "export").mockReturnValueOnce({
      diagnostics: [
        {
          code: "artifact.export-failed",
          severity: "error",
          message: "Export failed",
          path: [],
        },
      ],
    });
    await expect(
      exportWebServerDescriptionArtifact(snapshot, "mcpdesc-0.7", "json"),
    ).rejects.toThrow("Export failed");

    vi.spyOn(MCPDESC_0_7_ARTIFACT_PROVIDER, "validate").mockReturnValueOnce([
      {
        code: "artifact.validation-failed",
        severity: "error",
        message: "Validation failed",
        path: [],
      },
    ]);
    await expect(
      exportWebServerDescriptionArtifact(snapshot, "mcpdesc-0.7", "json"),
    ).rejects.toThrow("Validation failed");
  });

  it("uses a fallback message when a handler returns no payload or diagnostic", async () => {
    vi.spyOn(MCPDESC_0_7_ARTIFACT_PROVIDER, "export").mockReturnValueOnce({
      diagnostics: [],
    });
    await expect(
      exportWebServerDescriptionArtifact(snapshot, "mcpdesc-0.7", "json"),
    ).rejects.toThrow("produced no payload");
  });
});
