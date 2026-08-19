import { z } from "zod";
import type { ExtensionJsonObject } from "./json.js";

export const ArtifactOperationSchema = z.enum([
  "export",
  "import",
  "validate",
  "view",
]);

export type ArtifactOperation = z.infer<typeof ArtifactOperationSchema>;

export const ArtifactDataAccessSchema = z.enum(["none", "read"]);

export type ArtifactDataAccess = z.infer<typeof ArtifactDataAccessSchema>;

export interface ArtifactDataRequirements {
  serverDescription: ArtifactDataAccess;
  session: ArtifactDataAccess;
}

export interface ArtifactFormatContribution {
  id: string;
  displayName: string;
  artifactVersion: string;
  mediaTypes: string[];
  encodings: string[];
  operations: ArtifactOperation[];
  optionsSchema?: ExtensionJsonObject;
  dataRequirements: ArtifactDataRequirements;
}

export type ArtifactDiagnosticSeverity = "info" | "warning" | "error";

/** Stable, serializable diagnostic returned by artifact format handlers. */
export interface ArtifactDiagnostic {
  code: string;
  severity: ArtifactDiagnosticSeverity;
  message: string;
  path: Array<string | number>;
}

export const ArtifactDiagnosticSchema: z.ZodType<ArtifactDiagnostic> = z
  .object({
    code: z.string().trim().min(1),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().trim().min(1),
    path: z.array(z.union([z.string(), z.number().int()])),
  })
  .strict();

/** Serialized artifact content returned to a host-owned output sink. */
export interface ArtifactPayload {
  formatId: string;
  artifactVersion: string;
  encoding: string;
  mediaType: string;
  content: string;
}

export interface ArtifactExportResult {
  payload?: ArtifactPayload;
  diagnostics: ArtifactDiagnostic[];
}

export function artifactDiagnosticPath(
  path: readonly PropertyKey[],
): Array<string | number> {
  return path.map((segment) =>
    typeof segment === "symbol" ? String(segment) : segment,
  );
}
