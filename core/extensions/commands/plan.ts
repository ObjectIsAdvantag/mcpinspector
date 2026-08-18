import type {
  ConnectionRequirement,
  ServerSelectionRequirement,
} from "../api/commands.js";
import type { ExtensionJsonObject } from "../api/json.js";

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
 * Host-owned command plan produced after contribution selection and option
 * validation. The canonical contribution id is persisted even when a
 * human-facing alias selected the command.
 */
export interface CommandPlan {
  kind: "command";
  commandId: string;
  extensionId: string;
  serverSource: ServerSourceOptions;
  serverSelection: ServerSelectionRequirement;
  connection: ConnectionRequirement;
  options: ExtensionJsonObject;
  output: OutputOptions;
}
