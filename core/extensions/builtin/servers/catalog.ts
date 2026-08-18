import type {
  InspectorServerSettings,
  MCPServerConfig,
} from "../../../mcp/types.js";
import { InMemorySecretStore } from "../../../auth/node/secret-store.js";
import {
  loadServerEntries,
  selectServerEntry,
  type ServerLoadOptions,
} from "../../../mcp/node/index.js";

/** One catalog/config entry returned by the server-list command. */
export type ServerListEntry = {
  name: string;
  type: string;
  /** Command line, URL, or other short identity for display. */
  detail: string;
  /** Optional live-session name supplied by a session-aware caller. */
  session?: string;
  /** True when the annotated session is the most-recently-used session. */
  isMru?: boolean;
};

/** Minimal session shape needed to annotate catalog entries. */
export type SessionListRef = {
  name: string;
  isMru?: boolean;
};

/** Mark entries that have a live session with the same name, without mutation. */
export function annotateServerEntriesWithSessions(
  entries: ServerListEntry[],
  sessions: SessionListRef[],
): ServerListEntry[] {
  if (sessions.length === 0) return entries;
  const byName = new Map(sessions.map((session) => [session.name, session]));
  return entries.map((entry) => {
    const session = byName.get(entry.name);
    if (!session) return entry;
    return {
      ...entry,
      session: session.name,
      ...(session.isMru === true ? { isMru: true } : {}),
    };
  });
}

/** Detail view returned by the server-show command, with secrets redacted. */
export type ServerShowEntry = {
  name: string;
  type: string;
  detail: string;
  config: Record<string, unknown>;
  settings?: Record<string, unknown>;
};

const REDACTED = "[redacted]";

/** Summarize a server configuration without connecting to it. */
export function summarizeServerConfig(config: MCPServerConfig): {
  type: string;
  detail: string;
} {
  // Narrow URL transports first because stdio's `type` is optional.
  if (config.type === "sse" || config.type === "streamable-http") {
    return { type: config.type, detail: config.url ?? "" };
  }
  const args = config.args?.length ? ` ${config.args.join(" ")}` : "";
  return { type: "stdio", detail: `${config.command}${args}` };
}

/**
 * Load and sort server summaries. The empty secret store prevents a list
 * operation from reading the OS keychain because summaries never need secrets.
 */
export async function listServerEntries(
  serverOptions: ServerLoadOptions = {},
): Promise<ServerListEntry[]> {
  const entries = await loadServerEntries({
    ...serverOptions,
    secretStore: serverOptions.secretStore ?? new InMemorySecretStore(),
  });
  return Object.entries(entries)
    .map(([name, resolved]) => {
      const { type, detail } = summarizeServerConfig(resolved.config);
      return { name, type, detail };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Resolve and redact one server configuration without connecting to it. */
export async function showServerEntry(
  serverName: string,
  serverOptions: ServerLoadOptions = {},
): Promise<ServerShowEntry> {
  const name = serverName.trim();
  if (!name) {
    throw new Error("servers/show requires a server name.");
  }
  const entries = await loadServerEntries(serverOptions);
  const selected = selectServerEntry(entries, name);
  const { type, detail } = summarizeServerConfig(selected.config);
  const result: ServerShowEntry = {
    name,
    type,
    detail,
    config: sanitizeServerConfig(selected.config),
  };
  if (selected.settings) {
    result.settings = sanitizeServerSettings(selected.settings);
  }
  return result;
}

/** Redact secret-bearing fields in a transport configuration. */
export function sanitizeServerConfig(
  config: MCPServerConfig,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...config };
  if ("env" in config && config.env) {
    output.env = redactStringRecord(config.env);
  }
  if ("requestInit" in config && isPlainObject(config.requestInit)) {
    output.requestInit = sanitizeInitRecord(config.requestInit);
  }
  if ("eventSourceInit" in config && isPlainObject(config.eventSourceInit)) {
    output.eventSourceInit = sanitizeInitRecord(config.eventSourceInit);
  }
  return output;
}

/** Redact secret-bearing fields in Inspector-owned server settings. */
export function sanitizeServerSettings(
  settings: InspectorServerSettings,
): Record<string, unknown> {
  const output: Record<string, unknown> = {
    ...settings,
    headers: (settings.headers ?? []).map((header) => ({
      key: header.key,
      value: isSensitiveHeader(header.key) ? REDACTED : header.value,
    })),
    metadata: (settings.metadata ?? []).map((metadata) => ({
      key: metadata.key,
      value: isSensitiveHeader(metadata.key) ? REDACTED : metadata.value,
    })),
    env: (settings.env ?? []).map((environment) => ({
      key: environment.key,
      value: REDACTED,
    })),
  };
  if (settings.oauthClientSecret !== undefined) {
    output.oauthClientSecret = REDACTED;
  }
  return output;
}

function redactStringRecord(
  record: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(Object.keys(record).map((key) => [key, REDACTED]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeInitRecord(
  init: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...init };
  if (isPlainObject(init.headers)) {
    output.headers = Object.fromEntries(
      Object.entries(init.headers).map(([key, value]) => [
        key,
        isSensitiveHeader(key) ? REDACTED : value,
      ]),
    );
  } else if (Array.isArray(init.headers)) {
    output.headers = init.headers.map((entry) => {
      if (
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "string"
      ) {
        return [entry[0], isSensitiveHeader(entry[0]) ? REDACTED : entry[1]];
      }
      return entry;
    });
  }
  return output;
}

function isSensitiveHeader(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("auth") ||
    normalized.includes("cookie") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("password") ||
    normalized.includes("api-key") ||
    normalized.includes("apikey")
  );
}
