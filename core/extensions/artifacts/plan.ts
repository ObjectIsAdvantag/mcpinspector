import type {
  ArtifactDataRequirements,
  ArtifactOperation,
} from "../api/artifacts.js";
import type { ExtensionJsonObject } from "../api/json.js";

export type ArtifactOutputDestination =
  | { kind: "stdout" }
  | { kind: "file"; path: string };

/**
 * Host-owned artifact plan. Format, operation, encoding, version, and output
 * remain independent so later formats do not inherit native-session choices.
 */
export interface ArtifactPlan {
  kind: "artifact";
  formatId: string;
  extensionId: string;
  artifactVersion: string;
  operation: ArtifactOperation;
  encoding: string;
  mediaType: string;
  dataRequirements: ArtifactDataRequirements;
  options: ExtensionJsonObject;
  output: ArtifactOutputDestination;
}
