import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNativeSessionArtifact } from "@inspector/core/extensions/api/sessions.js";
import { INSPECTOR_SESSION_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/artifact.js";
import type { NativeSessionSnapshotInput } from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import { exportWebSessionArtifact } from "./exportSessionArtifact";

const snapshot: NativeSessionSnapshotInput = {
  inspectorVersion: "2.2.0",
  capturedAt: "2026-08-19T12:00:00.000Z",
  sessionId: "web-session",
  server: {
    source: { config: { env: { API_KEY: "secret-canary" } } },
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exportWebSessionArtifact", () => {
  it("returns a validated, redacted native-session document", async () => {
    const result = await exportWebSessionArtifact(snapshot);

    expect(result.content).not.toContain("secret-canary");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "artifact.value-redacted" }),
      ]),
    );
    expect(parseNativeSessionArtifact(result.content).ok).toBe(true);
  });

  it("rejects exports that produce no payload", async () => {
    vi.spyOn(INSPECTOR_SESSION_ARTIFACT_PROVIDER, "export").mockReturnValue({
      diagnostics: [
        {
          code: "artifact.export-failed",
          severity: "error",
          message: "Snapshot unavailable",
          path: [],
        },
      ],
    });

    await expect(exportWebSessionArtifact(snapshot)).rejects.toThrow(
      "Snapshot unavailable",
    );
  });

  it("rejects payloads that fail handler validation", async () => {
    vi.spyOn(INSPECTOR_SESSION_ARTIFACT_PROVIDER, "validate").mockReturnValue([
      {
        code: "artifact.validation-failed",
        severity: "error",
        message: "Invalid artifact",
        path: [],
      },
    ]);

    await expect(exportWebSessionArtifact(snapshot)).rejects.toThrow(
      "Invalid artifact",
    );
  });

  it("uses a fallback when an empty export has no diagnostic", async () => {
    vi.spyOn(INSPECTOR_SESSION_ARTIFACT_PROVIDER, "export").mockReturnValue({
      diagnostics: [],
    });

    await expect(exportWebSessionArtifact(snapshot)).rejects.toThrow(
      "Session export produced no payload",
    );
  });
});
