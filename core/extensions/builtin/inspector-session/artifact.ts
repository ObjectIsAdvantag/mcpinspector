import type {
  ArtifactDiagnostic,
  ArtifactExportResult,
  ArtifactPayload,
} from "../../api/artifacts.js";
import type { ArtifactFormatHandler } from "../../artifacts/service.js";
import type { ExtensionJsonObject } from "../../api/json.js";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  INSPECTOR_SESSION_MEDIA_TYPE,
  parseNativeSessionArtifact,
  serializeNativeSessionArtifact,
} from "../../api/sessions.js";
import { buildNativeSessionArtifact } from "./snapshot.js";

function metadataDiagnostic(message: string): ArtifactDiagnostic[] {
  return [
    {
      code: "artifact.payload-invalid",
      severity: "error",
      message,
      path: [],
    },
  ];
}

/** Native session export and validation behavior for the artifact service. */
export const INSPECTOR_SESSION_ARTIFACT_PROVIDER: ArtifactFormatHandler = {
  formatId: INSPECTOR_SESSION_FORMAT_ID,
  export(
    data: ExtensionJsonObject,
    _options: ExtensionJsonObject,
  ): ArtifactExportResult {
    const result = buildNativeSessionArtifact(data);
    if (!result.ok) return result;
    return {
      payload: {
        formatId: INSPECTOR_SESSION_FORMAT_ID,
        artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
        encoding: "json",
        mediaType: INSPECTOR_SESSION_MEDIA_TYPE,
        content: serializeNativeSessionArtifact(result.artifact),
      },
      diagnostics: result.artifact.diagnostics,
    };
  },
  validate(payload: ArtifactPayload): ArtifactDiagnostic[] {
    if (
      payload.formatId !== INSPECTOR_SESSION_FORMAT_ID ||
      payload.artifactVersion !== INSPECTOR_SESSION_ARTIFACT_VERSION ||
      payload.encoding !== "json" ||
      payload.mediaType !== INSPECTOR_SESSION_MEDIA_TYPE
    ) {
      return metadataDiagnostic(
        "Payload metadata does not identify an Inspector session v1 JSON artifact",
      );
    }
    const parsed = parseNativeSessionArtifact(payload.content);
    return parsed.ok ? [] : parsed.diagnostics;
  },
};
