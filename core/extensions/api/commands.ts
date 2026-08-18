import { z } from "zod";
import type { ExtensionJsonObject } from "./json.js";

export const ConnectionRequirementSchema = z.enum([
  "none",
  "resolved",
  "connected",
]);

export type ConnectionRequirement = z.infer<typeof ConnectionRequirementSchema>;

export const ServerSelectionRequirementSchema = z.enum([
  "none",
  "all",
  "exactly-one",
]);

export type ServerSelectionRequirement = z.infer<
  typeof ServerSelectionRequirementSchema
>;

export interface CommandContribution {
  id: string;
  /** Human-facing selectors; persisted plans always use {@link id}. */
  aliases?: string[];
  title: string;
  connection: ConnectionRequirement;
  serverSelection: ServerSelectionRequirement;
  optionsSchema?: ExtensionJsonObject;
}
