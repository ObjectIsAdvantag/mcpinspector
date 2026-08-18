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
