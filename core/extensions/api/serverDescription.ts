import { z } from "zod";
import { ArtifactDiagnosticSchema } from "./artifacts.js";
import { ExtensionJsonObjectSchema } from "./json.js";

function isSafeRemoteTransportUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

const SafeRemoteTransportUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    isSafeRemoteTransportUrl,
    "Remote transport URL must be HTTP(S) without credentials, query parameters, or a fragment",
  );

/**
 * Deliberately limited transport projection. Headers and environment variables
 * are not representable; hosts must provide only non-secret command arguments.
 */
export const ServerDescriptionTransportSourceSchema = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("stdio"),
        command: z.string().trim().min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal("streamable-http"),
        url: SafeRemoteTransportUrlSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("sse"),
        url: SafeRemoteTransportUrlSchema,
      })
      .strict(),
  ],
);

export type ServerDescriptionTransportSource = z.infer<
  typeof ServerDescriptionTransportSourceSchema
>;

/** Stable serializable input for server-description artifact handlers. */
export const ServerDescriptionSnapshotSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    protocolVersion: z.string().trim().min(1).optional(),
    protocolEra: z.enum(["legacy", "modern"]).optional(),
    serverInfo: ExtensionJsonObjectSchema.optional(),
    capabilities: ExtensionJsonObjectSchema.optional(),
    instructions: z.string().optional(),
    transport: ServerDescriptionTransportSourceSchema,
    tools: z.array(ExtensionJsonObjectSchema),
    resources: z.array(ExtensionJsonObjectSchema),
    resourceTemplates: z.array(ExtensionJsonObjectSchema),
    prompts: z.array(ExtensionJsonObjectSchema),
    diagnostics: z.array(ArtifactDiagnosticSchema),
  })
  .strict();

export type ServerDescriptionSnapshot = z.infer<
  typeof ServerDescriptionSnapshotSchema
>;
