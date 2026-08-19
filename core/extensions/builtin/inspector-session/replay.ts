import {
  ExtensionJsonValueSchema,
  type ExtensionJsonObject,
  type ExtensionJsonValue,
} from "../../api/json.js";
import type { NativeSessionArtifact } from "../../api/sessions.js";

export type NativeSessionReplaySectionId =
  | "overview"
  | "tools"
  | "resources"
  | "resourceTemplates"
  | "prompts"
  | "protocol"
  | "network"
  | "stderr"
  | "console"
  | "tasks"
  | "subscriptions"
  | "auth"
  | "attachments"
  | "diagnostics"
  | "additional";

export type NativeSessionReplayValue =
  | string
  | number
  | boolean
  | null
  | NativeSessionReplayObject
  | readonly NativeSessionReplayValue[];

export interface NativeSessionReplayObject {
  readonly [key: string]: NativeSessionReplayValue;
}

export interface NativeSessionReplayEntry {
  readonly id: string;
  readonly label: string;
  readonly value: NativeSessionReplayValue;
}

export interface NativeSessionReplaySection {
  readonly id: NativeSessionReplaySectionId;
  readonly label: string;
  readonly entries: readonly NativeSessionReplayEntry[];
}

export interface NativeSessionReplayMetadata {
  readonly formatId: string;
  readonly formatVersion: string;
  readonly inspectorVersion: string;
  readonly capturedAt: string;
  readonly sessionId: string;
  readonly serverName: string;
  readonly protocolVersion?: string;
  readonly protocolEra?: "legacy" | "modern";
}

/**
 * Immutable projection of a parsed native-session artifact. It exposes only
 * captured JSON values and metadata: there is no client, transport, OAuth,
 * process, fetch, or extension-activation capability on this boundary.
 */
export interface NativeSessionReplayStore {
  readonly metadata: NativeSessionReplayMetadata;
  readonly sections: readonly [
    NativeSessionReplaySection,
    ...NativeSessionReplaySection[],
  ];
}

const TOP_LEVEL_KEYS = new Set([
  "header",
  "server",
  "discovery",
  "events",
  "attachments",
  "diagnostics",
]);
const DISCOVERY_KEYS = new Set([
  "tools",
  "resources",
  "resourceTemplates",
  "prompts",
  "diagnostics",
]);
const EVENT_KEYS = new Set([
  "protocol",
  "network",
  "stderr",
  "console",
  "tasks",
  "subscriptions",
  "auth",
]);

const SUMMARY_KEYS: Partial<
  Record<NativeSessionReplaySectionId, readonly string[]>
> = {
  tools: ["name"],
  resources: ["name", "uri"],
  resourceTemplates: ["name", "uriTemplate"],
  prompts: ["name"],
  stderr: ["message"],
  console: ["logger", "level"],
  tasks: ["taskId", "id", "status"],
  auth: ["type", "method", "url"],
  attachments: ["id", "mediaType"],
};

function freezeReplayValue(
  value: ExtensionJsonValue,
): NativeSessionReplayValue {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeReplayValue));
  }
  if (value !== null && typeof value === "object") {
    const result = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        freezeReplayValue(child),
      ]),
    );
    return Object.freeze(result);
  }
  return value;
}

function replayObject(
  value: ExtensionJsonValue,
): ExtensionJsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function textProperty(
  value: ExtensionJsonObject | undefined,
  key: string,
): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : undefined;
}

function nestedTextProperty(
  value: ExtensionJsonObject | undefined,
  parentKey: string,
  key: string,
): string | undefined {
  const parent = value?.[parentKey];
  return parent === null || typeof parent !== "object" || Array.isArray(parent)
    ? undefined
    : textProperty(parent, key);
}

function compactLabel(value: string): string {
  const singleLine = value.replaceAll(/\s+/g, " ").trim();
  return singleLine.length > 96 ? `${singleLine.slice(0, 93)}...` : singleLine;
}

function entryLabel(
  sectionId: NativeSessionReplaySectionId,
  value: ExtensionJsonValue,
  index: number,
): string {
  if (sectionId === "overview") return "Session metadata";
  if (sectionId === "additional") return "Additional artifact data";

  const object = replayObject(value);
  if (sectionId === "protocol") {
    const method = nestedTextProperty(object, "message", "method");
    if (method) return compactLabel(method);
  }
  if (sectionId === "network") {
    const method = textProperty(object, "method");
    const url = textProperty(object, "url");
    if (method && url) return compactLabel(`${method} ${url}`);
  }
  if (sectionId === "subscriptions") {
    const uri = nestedTextProperty(object, "resource", "uri");
    if (uri) return compactLabel(uri);
  }
  if (sectionId === "diagnostics") {
    const severity = textProperty(object, "severity");
    const code = textProperty(object, "code");
    if (severity && code) return `${severity.toUpperCase()} · ${code}`;
  }

  for (const key of SUMMARY_KEYS[sectionId] ?? ["id", "name", "uri"]) {
    const candidate = textProperty(object, key);
    if (candidate) return compactLabel(candidate);
  }
  return `Entry ${index + 1}`;
}

function createEntry(
  sectionId: NativeSessionReplaySectionId,
  value: unknown,
  index: number,
): NativeSessionReplayEntry {
  const parsed = ExtensionJsonValueSchema.parse(value);
  return Object.freeze({
    id: `${sectionId}-${index}`,
    label: entryLabel(sectionId, parsed, index),
    value: freezeReplayValue(parsed),
  });
}

function createSection(
  id: NativeSessionReplaySectionId,
  label: string,
  values: readonly unknown[],
): NativeSessionReplaySection {
  return Object.freeze({
    id,
    label,
    entries: Object.freeze(
      values.map((value, index) => createEntry(id, value, index)),
    ),
  });
}

function additionalFields(
  value: ExtensionJsonObject,
  knownKeys: ReadonlySet<string>,
): ExtensionJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !knownKeys.has(key)),
  );
}

function hasFields(value: ExtensionJsonObject): boolean {
  return Object.keys(value).length > 0;
}

function serverName(artifact: NativeSessionArtifact): string {
  return (
    textProperty(artifact.server.implementation, "name") ??
    textProperty(artifact.server.source, "name") ??
    textProperty(artifact.server.source, "id") ??
    "Unknown server"
  );
}

/** Build an immutable, read-only section store from a validated artifact. */
export function createNativeSessionReplayStore(
  artifact: NativeSessionArtifact,
): NativeSessionReplayStore {
  const sections: [
    NativeSessionReplaySection,
    ...NativeSessionReplaySection[],
  ] = [
    createSection("overview", "Overview", [
      { header: artifact.header, server: artifact.server },
    ]),
  ];

  const sectionValues: Array<
    readonly [NativeSessionReplaySectionId, string, readonly unknown[]]
  > = [
    ["tools", "Tools", artifact.discovery.tools],
    ["resources", "Resources", artifact.discovery.resources],
    [
      "resourceTemplates",
      "Resource Templates",
      artifact.discovery.resourceTemplates,
    ],
    ["prompts", "Prompts", artifact.discovery.prompts],
    ["protocol", "Protocol", artifact.events.protocol],
    ["network", "Network", artifact.events.network],
    ["stderr", "Server Console", artifact.events.stderr],
    ["console", "Logs", artifact.events.console],
    ["tasks", "Tasks", artifact.events.tasks],
    ["subscriptions", "Subscriptions", artifact.events.subscriptions],
    ["auth", "Authentication", artifact.events.auth],
    ["attachments", "Attachments", artifact.attachments],
  ];
  for (const [id, label, values] of sectionValues) {
    if (values.length > 0) sections.push(createSection(id, label, values));
  }

  const diagnosticValues = [
    ...artifact.discovery.diagnostics.map((diagnostic) => ({
      scope: "discovery",
      ...diagnostic,
    })),
    ...artifact.diagnostics.map((diagnostic) => ({
      scope: "artifact",
      ...diagnostic,
    })),
  ];
  if (diagnosticValues.length > 0) {
    sections.push(
      createSection("diagnostics", "Diagnostics", diagnosticValues),
    );
  }

  const topLevelAdditional = additionalFields(artifact, TOP_LEVEL_KEYS);
  const discoveryAdditional = additionalFields(
    artifact.discovery,
    DISCOVERY_KEYS,
  );
  const eventAdditional = additionalFields(artifact.events, EVENT_KEYS);
  const additional: ExtensionJsonObject = {
    ...(hasFields(topLevelAdditional) && {
      artifact: topLevelAdditional,
    }),
    ...(hasFields(discoveryAdditional) && {
      discovery: discoveryAdditional,
    }),
    ...(hasFields(eventAdditional) && { events: eventAdditional }),
  };
  if (hasFields(additional)) {
    sections.push(createSection("additional", "Additional Data", [additional]));
  }

  const metadata: NativeSessionReplayMetadata = Object.freeze({
    formatId: artifact.header.format.id,
    formatVersion: artifact.header.format.version,
    inspectorVersion: artifact.header.inspectorVersion,
    capturedAt: artifact.header.capturedAt,
    sessionId: artifact.header.sessionId,
    serverName: serverName(artifact),
    ...(artifact.server.protocolVersion !== undefined && {
      protocolVersion: artifact.server.protocolVersion,
    }),
    ...(artifact.server.protocolEra !== undefined && {
      protocolEra: artifact.server.protocolEra,
    }),
  });

  return Object.freeze({ metadata, sections: Object.freeze(sections) });
}
