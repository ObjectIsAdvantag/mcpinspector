import type { ArtifactDiagnostic } from "@inspector/core/extensions/api/artifacts.js";
import { ExtensionJsonObjectSchema } from "@inspector/core/extensions/api/json.js";
import type { ServerDescriptionSnapshot } from "@inspector/core/extensions/api/serverDescription.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import {
  type McpDescription07Encoding,
  mcpDescription07MediaType,
} from "@inspector/core/extensions/builtin/mcpdesc-0.7/constants.js";

export interface WebServerDescriptionArtifactExport {
  content: string;
  mediaType: string;
  diagnostics: ArtifactDiagnostic[];
}

function diagnosticMessage(diagnostics: ArtifactDiagnostic[]): string {
  return diagnostics.map(({ message }) => message).join("; ");
}

/** Export and validate one brokered server snapshot without browser I/O. */
export async function exportWebServerDescriptionArtifact(
  snapshot: ServerDescriptionSnapshot,
  encoding: McpDescription07Encoding,
): Promise<WebServerDescriptionArtifactExport> {
  const data = ExtensionJsonObjectSchema.parse(snapshot);
  const result = MCPDESC_0_7_ARTIFACT_PROVIDER.export(data, {}, encoding);
  if (result.payload === undefined) {
    throw new Error(
      diagnosticMessage(result.diagnostics) ||
        "Server description export produced no payload",
    );
  }

  const validationDiagnostics = MCPDESC_0_7_ARTIFACT_PROVIDER.validate(
    result.payload,
  );
  const diagnostics = [...result.diagnostics, ...validationDiagnostics];
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) throw new Error(diagnosticMessage(errors));

  return {
    content: result.payload.content,
    mediaType: mcpDescription07MediaType(encoding),
    diagnostics,
  };
}
