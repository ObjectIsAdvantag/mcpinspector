import type { ArtifactDiagnostic } from "@inspector/core/extensions/api/artifacts.js";
import type { NativeSessionSnapshotInput } from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import { INSPECTOR_SESSION_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/artifact.js";

export interface WebSessionArtifactExport {
  content: string;
  diagnostics: ArtifactDiagnostic[];
}

function diagnosticMessage(diagnostics: ArtifactDiagnostic[]): string {
  return diagnostics.map(({ message }) => message).join("; ");
}

/** Export and validate a Web snapshot without granting the handler browser I/O. */
export async function exportWebSessionArtifact(
  snapshot: NativeSessionSnapshotInput,
): Promise<WebSessionArtifactExport> {
  const result = await INSPECTOR_SESSION_ARTIFACT_PROVIDER.export(snapshot, {});
  if (result.payload === undefined) {
    throw new Error(
      diagnosticMessage(result.diagnostics) ||
        "Session export produced no payload",
    );
  }

  const validationDiagnostics =
    await INSPECTOR_SESSION_ARTIFACT_PROVIDER.validate(result.payload);
  const diagnostics = [...result.diagnostics, ...validationDiagnostics];
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) throw new Error(diagnosticMessage(errors));

  return { content: result.payload.content, diagnostics };
}
