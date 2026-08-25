import { validateMcpDescription } from "@mcpdesc/validator";
import type { ArtifactDiagnostic } from "../../api/artifacts.js";

export function validateMcpDescription08Draft1Document(
  document: unknown,
): ArtifactDiagnostic[] {
  return validateMcpDescription(document, {
    specification: "0.8.0-draft.1",
  }).diagnostics.map((diagnostic) => ({
    ...diagnostic,
    path: [...diagnostic.path],
  }));
}
