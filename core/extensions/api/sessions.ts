import { z } from "zod";
import {
  ArtifactDiagnosticSchema,
  artifactDiagnosticPath,
  type ArtifactDiagnostic,
} from "./artifacts.js";
import { ExtensionJsonObjectSchema, ExtensionJsonValueSchema } from "./json.js";

export const INSPECTOR_SESSION_FORMAT_ID =
  "modelcontextprotocol.inspector-session-1";
export const INSPECTOR_SESSION_ARTIFACT_VERSION = "1.0.0";
export const INSPECTOR_SESSION_MEDIA_TYPE =
  "application/vnd.modelcontextprotocol.inspector-session+json";
export const DEFAULT_MAX_SESSION_ARTIFACT_BYTES = 50 * 1024 * 1024;

const ExtensibleObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).catchall(ExtensionJsonValueSchema);

export const NativeSessionHeaderSchema = ExtensibleObject({
  format: z
    .object({
      id: z.literal(INSPECTOR_SESSION_FORMAT_ID),
      version: z.literal(INSPECTOR_SESSION_ARTIFACT_VERSION),
    })
    .strict(),
  inspectorVersion: z.string().trim().min(1),
  capturedAt: z.string().datetime({ offset: true }),
  sessionId: z.string().trim().min(1),
});

export const NativeSessionServerSchema = ExtensibleObject({
  source: ExtensionJsonObjectSchema.optional(),
  protocolVersion: z.string().trim().min(1).optional(),
  protocolEra: z.enum(["legacy", "modern"]).optional(),
  implementation: ExtensionJsonObjectSchema.optional(),
  capabilities: ExtensionJsonObjectSchema.optional(),
  instructions: z.string().optional(),
});

export const NativeSessionDiscoverySchema = ExtensibleObject({
  tools: z.array(ExtensionJsonObjectSchema),
  resources: z.array(ExtensionJsonObjectSchema),
  resourceTemplates: z.array(ExtensionJsonObjectSchema),
  prompts: z.array(ExtensionJsonObjectSchema),
  diagnostics: z.array(ArtifactDiagnosticSchema),
});

export const NativeSessionEventsSchema = ExtensibleObject({
  protocol: z.array(ExtensionJsonObjectSchema),
  network: z.array(ExtensionJsonObjectSchema),
  stderr: z.array(ExtensionJsonObjectSchema),
  console: z.array(ExtensionJsonObjectSchema),
  tasks: z.array(ExtensionJsonObjectSchema),
  subscriptions: z.array(ExtensionJsonObjectSchema),
  auth: z.array(ExtensionJsonObjectSchema),
});

export const NativeSessionAttachmentSchema = ExtensibleObject({
  id: z.string().trim().min(1),
  mediaType: z.string().trim().min(1),
  byteLength: z.number().int().nonnegative(),
  reference: z.string().trim().min(1),
});

export const NativeSessionArtifactSchema = ExtensibleObject({
  header: NativeSessionHeaderSchema,
  server: NativeSessionServerSchema,
  discovery: NativeSessionDiscoverySchema,
  events: NativeSessionEventsSchema,
  attachments: z.array(NativeSessionAttachmentSchema),
  diagnostics: z.array(ArtifactDiagnosticSchema),
});

export type NativeSessionArtifact = z.infer<typeof NativeSessionArtifactSchema>;

export interface NativeSessionParseSuccess {
  ok: true;
  artifact: NativeSessionArtifact;
}

export interface NativeSessionParseFailure {
  ok: false;
  diagnostics: ArtifactDiagnostic[];
}

export type NativeSessionParseResult =
  | NativeSessionParseSuccess
  | NativeSessionParseFailure;

function failure(
  code: string,
  message: string,
  path: Array<string | number> = [],
): NativeSessionParseFailure {
  return {
    ok: false,
    diagnostics: [{ code, severity: "error", message, path }],
  };
}

function objectProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(value, key)
    ? Reflect.get(value, key)
    : undefined;
}

/** Parse an untrusted native session without performing I/O or activation. */
export function parseNativeSessionArtifact(
  input: string | unknown,
  maxBytes = DEFAULT_MAX_SESSION_ARTIFACT_BYTES,
): NativeSessionParseResult {
  let candidate = input;
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > maxBytes) {
      return failure(
        "artifact.too-large",
        `Session artifact exceeds the ${maxBytes}-byte limit`,
      );
    }
    try {
      candidate = JSON.parse(input);
    } catch {
      return failure(
        "artifact.invalid-json",
        "Session artifact is not valid JSON",
      );
    }
  }

  const header = objectProperty(candidate, "header");
  const format = objectProperty(header, "format");
  const formatId = objectProperty(format, "id");
  const version = objectProperty(format, "version");
  if (formatId !== undefined && formatId !== INSPECTOR_SESSION_FORMAT_ID) {
    return failure(
      "artifact.format-unsupported",
      `Unsupported artifact format: ${String(formatId)}`,
      ["header", "format", "id"],
    );
  }
  if (version !== undefined && version !== INSPECTOR_SESSION_ARTIFACT_VERSION) {
    return failure(
      "artifact.version-unsupported",
      `Unsupported Inspector session artifact version: ${String(version)}`,
      ["header", "format", "version"],
    );
  }

  const parsed = NativeSessionArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: parsed.error.issues.map((issue) => ({
        code: "artifact.schema-invalid",
        severity: "error",
        message: issue.message,
        path: artifactDiagnosticPath(issue.path),
      })),
    };
  }
  return { ok: true, artifact: parsed.data };
}

export function serializeNativeSessionArtifact(
  artifact: NativeSessionArtifact,
): string {
  return JSON.stringify(NativeSessionArtifactSchema.parse(artifact), null, 2);
}
