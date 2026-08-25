import type {
  ArtifactDiagnostic,
  ArtifactExportResult,
  ArtifactPayload,
} from "../../api/artifacts.js";
import type { ExtensionJsonObject } from "../../api/json.js";
import type { ArtifactFormatHandler } from "../../artifacts/service.js";
import {
  MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
  MCPDESC_0_8_DRAFT_1_FORMAT_ID,
  isMcpDescription08Draft1Encoding,
  mcpDescription08Draft1MediaType,
  type McpDescription08Draft1Encoding,
} from "./constants.js";
import {
  encodeMcpDescription08Draft1,
  parseMcpDescription08Draft1,
} from "./encoding.js";
import { buildMcpDescription08Draft1Document } from "./mapper.js";
import { validateMcpDescription08Draft1Document } from "./validation.js";

function errorDiagnostic(code: string, message: string): ArtifactDiagnostic[] {
  return [{ code, severity: "error", message, path: [] }];
}

function hasMcpDescription08Draft1Metadata(
  payload: ArtifactPayload,
): payload is ArtifactPayload & { encoding: McpDescription08Draft1Encoding } {
  return (
    payload.formatId === MCPDESC_0_8_DRAFT_1_FORMAT_ID &&
    payload.artifactVersion === MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION &&
    isMcpDescription08Draft1Encoding(payload.encoding) &&
    payload.mediaType === mcpDescription08Draft1MediaType(payload.encoding)
  );
}

/** MCP Description Draft 1 export and validation artifact behavior. */
export const MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER = {
  formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
  export(
    data: ExtensionJsonObject,
    _options: ExtensionJsonObject,
    selectedEncoding = "json",
  ): ArtifactExportResult {
    if (!isMcpDescription08Draft1Encoding(selectedEncoding)) {
      return {
        diagnostics: errorDiagnostic(
          "artifact.encoding-unsupported",
          `MCP Description 0.8.0 Draft 1 does not support encoding: ${selectedEncoding}`,
        ),
      };
    }
    const result = buildMcpDescription08Draft1Document(data);
    if (!result.ok) return result;
    return {
      payload: {
        formatId: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
        artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
        encoding: selectedEncoding,
        mediaType: mcpDescription08Draft1MediaType(selectedEncoding),
        content: encodeMcpDescription08Draft1(
          result.document,
          selectedEncoding,
        ),
      },
      diagnostics: result.diagnostics,
    };
  },
  validate(payload: ArtifactPayload): ArtifactDiagnostic[] {
    if (!hasMcpDescription08Draft1Metadata(payload)) {
      return errorDiagnostic(
        "artifact.payload-invalid",
        "Payload metadata does not identify a supported MCP Description 0.8.0 Draft 1 JSON or YAML artifact",
      );
    }
    let document: unknown;
    try {
      document = parseMcpDescription08Draft1(payload.content, payload.encoding);
    } catch {
      return errorDiagnostic(
        payload.encoding === "json"
          ? "artifact.invalid-json"
          : "artifact.invalid-yaml",
        `MCP Description content is not valid ${payload.encoding.toUpperCase()}`,
      );
    }
    return validateMcpDescription08Draft1Document(document);
  },
} satisfies ArtifactFormatHandler;
