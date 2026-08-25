import type { ArtifactDiagnostic } from "@inspector/core/extensions/api/artifacts.js";
import { ExtensionJsonObjectSchema } from "@inspector/core/extensions/api/json.js";
import type { ServerDescriptionSnapshot } from "@inspector/core/extensions/api/serverDescription.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import { MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.8-draft.1/artifact.js";

export type WebServerDescriptionFormat = "mcpdesc-0.7" | "mcpdesc-0.8-draft.1";
export type WebServerDescriptionEncoding = "json" | "yaml";
export type WebServerDescriptionDisabledReasons = Partial<
  Record<WebServerDescriptionFormat, string>
>;

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
  format: WebServerDescriptionFormat,
  encoding: WebServerDescriptionEncoding,
): Promise<WebServerDescriptionArtifactExport> {
  const data = ExtensionJsonObjectSchema.parse(snapshot);
  const provider =
    format === "mcpdesc-0.7"
      ? MCPDESC_0_7_ARTIFACT_PROVIDER
      : MCPDESC_0_8_DRAFT_1_ARTIFACT_PROVIDER;
  const result = provider.export(data, {}, encoding);
  if (result.payload === undefined) {
    throw new Error(
      diagnosticMessage(result.diagnostics) ||
        "Server description export produced no payload",
    );
  }

  const validationDiagnostics = provider.validate(result.payload);
  const diagnostics = [...result.diagnostics, ...validationDiagnostics];
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) throw new Error(diagnosticMessage(errors));

  return {
    content: result.payload.content,
    mediaType: result.payload.mediaType,
    diagnostics,
  };
}
