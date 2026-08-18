import type {
  ConnectionRequirement,
  ServerSelectionRequirement,
} from "./commands.js";
import type { ExtensionJsonObject } from "./json.js";

export type ServerSourceOptions =
  | { kind: "default-catalog" }
  | { kind: "catalog"; path: string }
  | { kind: "config"; path: string }
  | { kind: "ad-hoc"; target: string[] };

export type OutputDestination =
  | { kind: "stdout" }
  | { kind: "file"; path: string };

export interface OutputOptions {
  destination: OutputDestination;
  encoding?: string;
}

/**
 * Host-owned plan produced after contribution selection and option validation.
 * This is a contract skeleton only; the current CLI parser is migrated to it in
 * the next Phase 1 slice.
 */
export interface CommandExecutionPlan {
  commandId: string;
  extensionId: string;
  serverSource: ServerSourceOptions;
  serverSelection: ServerSelectionRequirement;
  connection: ConnectionRequirement;
  options: ExtensionJsonObject;
  output: OutputOptions;
}
