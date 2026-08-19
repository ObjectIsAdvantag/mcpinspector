import { z } from "zod";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  NativeSessionAttachmentSchema,
  NativeSessionArtifactSchema,
  NativeSessionServerSchema,
  type NativeSessionArtifact,
} from "../../api/sessions.js";
import {
  ExtensionJsonObjectSchema,
  ExtensionJsonValueSchema,
  type ExtensionJsonObject,
  type ExtensionJsonValue,
} from "../../api/json.js";
import {
  ArtifactDiagnosticSchema,
  artifactDiagnosticPath,
  type ArtifactDiagnostic,
} from "../../api/artifacts.js";
import { redactBody, redactUrlQuery } from "../../../mcp/fetchTracking.js";

export const SESSION_REDACTED_VALUE = "[REDACTED]";

const SnapshotSectionSchema = z
  .object({
    tools: z.array(ExtensionJsonObjectSchema).optional(),
    resources: z.array(ExtensionJsonObjectSchema).optional(),
    resourceTemplates: z.array(ExtensionJsonObjectSchema).optional(),
    prompts: z.array(ExtensionJsonObjectSchema).optional(),
    diagnostics: z.array(ArtifactDiagnosticSchema).optional(),
  })
  .catchall(ExtensionJsonValueSchema);

const EventSectionSchema = z
  .object({
    protocol: z.array(ExtensionJsonObjectSchema).optional(),
    network: z.array(ExtensionJsonObjectSchema).optional(),
    stderr: z.array(ExtensionJsonObjectSchema).optional(),
    console: z.array(ExtensionJsonObjectSchema).optional(),
    tasks: z.array(ExtensionJsonObjectSchema).optional(),
    subscriptions: z.array(ExtensionJsonObjectSchema).optional(),
    auth: z.array(ExtensionJsonObjectSchema).optional(),
  })
  .catchall(ExtensionJsonValueSchema);

export const NativeSessionSnapshotInputSchema = z
  .object({
    inspectorVersion: z.string().trim().min(1),
    capturedAt: z.string().datetime({ offset: true }),
    sessionId: z.string().trim().min(1),
    server: NativeSessionServerSchema.optional(),
    discovery: SnapshotSectionSchema.optional(),
    events: EventSectionSchema.optional(),
    attachments: z.array(NativeSessionAttachmentSchema).optional(),
    diagnostics: z.array(ArtifactDiagnosticSchema).optional(),
  })
  .catchall(ExtensionJsonValueSchema);

export type NativeSessionSnapshotInput = z.infer<
  typeof NativeSessionSnapshotInputSchema
>;

export interface NativeSessionBuildSuccess {
  ok: true;
  artifact: NativeSessionArtifact;
}

export interface NativeSessionBuildFailure {
  ok: false;
  diagnostics: ArtifactDiagnostic[];
}

export type NativeSessionBuildResult =
  | NativeSessionBuildSuccess
  | NativeSessionBuildFailure;

const SENSITIVE_KEYS = new Set([
  "accesstoken",
  "apikey",
  "assertion",
  "authorization",
  "clientassertion",
  "clientsecret",
  "code",
  "codeverifier",
  "cookie",
  "idtoken",
  "password",
  "proxyauthorization",
  "refreshtoken",
  "setcookie",
  "token",
  "xapikey",
  "xmcpremoteauth",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll(/[-_]/g, "");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("authorization") ||
    normalized.endsWith("cookie") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  );
}

function redactionDiagnostic(path: Array<string | number>): ArtifactDiagnostic {
  return {
    code: "artifact.value-redacted",
    severity: "info",
    message: "A sensitive value was removed from the session artifact",
    path,
  };
}

function redactJsonString(
  value: string,
  path: Array<string | number>,
  diagnostics: ArtifactDiagnostic[],
): string {
  try {
    const parsed: unknown = JSON.parse(value);
    const json = ExtensionJsonValueSchema.safeParse(parsed);
    if (!json.success) return value;
    const redacted = redactValue(json.data, path, diagnostics);
    return JSON.stringify(redacted);
  } catch {
    const redacted =
      redactBody(value, "application/x-www-form-urlencoded") ?? value;
    if (redacted !== value) diagnostics.push(redactionDiagnostic(path));
    return redacted;
  }
}

function redactSessionUrl(value: string): string {
  const knownRedacted = redactUrlQuery(value);
  const queryStart = knownRedacted.indexOf("?");
  if (queryStart === -1) return knownRedacted;

  const base = knownRedacted.slice(0, queryStart);
  const afterQuery = knownRedacted.slice(queryStart + 1);
  const hashStart = afterQuery.indexOf("#");
  const query = hashStart === -1 ? afterQuery : afterQuery.slice(0, hashStart);
  const fragment = hashStart === -1 ? "" : afterQuery.slice(hashStart);
  const params = new URLSearchParams(query);
  let changed = false;
  for (const key of new Set(params.keys())) {
    if (isSensitiveKey(key)) {
      changed = true;
      params.set(key, SESSION_REDACTED_VALUE);
    }
  }
  return changed ? `${base}?${params.toString()}${fragment}` : knownRedacted;
}

function redactString(
  key: string,
  value: string,
  path: Array<string | number>,
  diagnostics: ArtifactDiagnostic[],
): string {
  if (key.toLowerCase() === "url") {
    const redacted = redactSessionUrl(value);
    if (redacted !== value) diagnostics.push(redactionDiagnostic(path));
    return redacted;
  }
  if (key.toLowerCase().endsWith("body")) {
    return redactJsonString(value, path, diagnostics);
  }
  return value;
}

function redactValue(
  value: ExtensionJsonValue,
  path: Array<string | number>,
  diagnostics: ArtifactDiagnostic[],
): ExtensionJsonValue {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      redactValue(item, [...path, index], diagnostics),
    );
  }
  if (value !== null && typeof value === "object") {
    return redactObject(value, path, diagnostics);
  }
  return value;
}

function redactObject(
  value: ExtensionJsonObject,
  path: Array<string | number>,
  diagnostics: ArtifactDiagnostic[],
): ExtensionJsonObject {
  const result: ExtensionJsonObject = {};
  const declaredName =
    typeof value.key === "string"
      ? value.key
      : typeof value.name === "string"
        ? value.name
        : undefined;
  const parentSegment = path.at(-1);
  const grandparentSegment = path.at(-2);
  const environmentRecord =
    typeof parentSegment === "string" && normalizeKey(parentSegment) === "env";
  const environmentPair =
    typeof parentSegment === "number" &&
    typeof grandparentSegment === "string" &&
    normalizeKey(grandparentSegment) === "env";
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    const namedSensitiveValue =
      key.toLowerCase() === "value" &&
      declaredName !== undefined &&
      isSensitiveKey(declaredName);
    const directSensitiveValue =
      isSensitiveKey(key) &&
      (normalizeKey(key) !== "code" || typeof child === "string");
    const environmentValue =
      environmentRecord || (environmentPair && normalizeKey(key) === "value");
    if (directSensitiveValue || namedSensitiveValue || environmentValue) {
      result[key] = SESSION_REDACTED_VALUE;
      diagnostics.push(redactionDiagnostic(childPath));
    } else if (typeof child === "string") {
      result[key] = redactString(key, child, childPath, diagnostics);
    } else {
      result[key] = redactValue(child, childPath, diagnostics);
    }
  }
  return result;
}

function schemaDiagnostics(error: z.ZodError): ArtifactDiagnostic[] {
  return error.issues.map((issue) => ({
    code: "artifact.snapshot-invalid",
    severity: "error",
    message: issue.message,
    path: artifactDiagnosticPath(issue.path),
  }));
}

/** Build one redacted artifact from serializable surface adapters. */
export function buildNativeSessionArtifact(
  input: unknown,
): NativeSessionBuildResult {
  const parsedInput = NativeSessionSnapshotInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, diagnostics: schemaDiagnostics(parsedInput.error) };
  }

  const serializable: ExtensionJsonObject = parsedInput.data;
  const redactionDiagnostics: ArtifactDiagnostic[] = [];
  const redacted = redactObject(serializable, [], redactionDiagnostics);
  const {
    inspectorVersion,
    capturedAt,
    sessionId,
    server,
    discovery: rawDiscovery,
    events: rawEvents,
    attachments,
    diagnostics,
    ...extensionFields
  } = redacted;
  const discoveryResult = ExtensionJsonObjectSchema.safeParse(rawDiscovery);
  const eventResult = ExtensionJsonObjectSchema.safeParse(rawEvents);
  const discovery = discoveryResult.success ? discoveryResult.data : undefined;
  const events = eventResult.success ? eventResult.data : undefined;

  const candidate = {
    ...extensionFields,
    header: {
      format: {
        id: INSPECTOR_SESSION_FORMAT_ID,
        version: INSPECTOR_SESSION_ARTIFACT_VERSION,
      },
      inspectorVersion,
      capturedAt,
      sessionId,
    },
    server: server ?? {},
    discovery: {
      ...(discovery ?? {}),
      tools: discovery?.tools ?? [],
      resources: discovery?.resources ?? [],
      resourceTemplates: discovery?.resourceTemplates ?? [],
      prompts: discovery?.prompts ?? [],
      diagnostics: discovery?.diagnostics ?? [],
    },
    events: {
      ...(events ?? {}),
      protocol: events?.protocol ?? [],
      network: events?.network ?? [],
      stderr: events?.stderr ?? [],
      console: events?.console ?? [],
      tasks: events?.tasks ?? [],
      subscriptions: events?.subscriptions ?? [],
      auth: events?.auth ?? [],
    },
    attachments: attachments ?? [],
    diagnostics: [
      ...(Array.isArray(diagnostics) ? diagnostics : []),
      ...redactionDiagnostics,
    ],
  };
  const artifact = NativeSessionArtifactSchema.safeParse(candidate);
  /* v8 ignore next -- validated input plus builder-owned defaults guarantee this shape */
  if (!artifact.success) {
    return { ok: false, diagnostics: schemaDiagnostics(artifact.error) };
  }
  return { ok: true, artifact: artifact.data };
}
