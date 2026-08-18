import { z } from "zod";
import type { ExtensionDiagnostic } from "../api/diagnostics.js";
import {
  InspectorExtensionManifestSchema,
  type InspectorExtensionManifest,
} from "./schema.js";

export type ParseExtensionManifestResult =
  | { ok: true; manifest: InspectorExtensionManifest }
  | { ok: false; diagnostics: ExtensionDiagnostic[] };

function issueToDiagnostic(issue: z.core.$ZodIssue): ExtensionDiagnostic {
  return {
    code: "extension.manifest-invalid",
    message: issue.message,
    path: issue.path.map((segment) =>
      typeof segment === "number" ? segment : String(segment),
    ),
  };
}

/** Parse unknown manifest data without loading or importing extension code. */
export function parseExtensionManifest(
  rawManifest: unknown,
): ParseExtensionManifestResult {
  const result = InspectorExtensionManifestSchema.safeParse(rawManifest);
  if (!result.success) {
    return {
      ok: false,
      diagnostics: result.error.issues.map(issueToDiagnostic),
    };
  }
  return { ok: true, manifest: result.data };
}
