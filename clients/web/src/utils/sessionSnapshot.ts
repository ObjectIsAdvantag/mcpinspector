import { z } from "zod";
import type {
  ClientCapabilities,
  Implementation,
  ProtocolEra,
  ServerCapabilities,
} from "@modelcontextprotocol/client";
import {
  ExtensionJsonObjectSchema,
  type ExtensionJsonObject,
} from "@inspector/core/extensions/api/json.js";
import {
  NativeSessionSnapshotInputSchema,
  type NativeSessionSnapshotInput,
} from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import type { ServerEntry } from "@inspector/core/mcp/types.js";

export interface WebSessionSnapshotContext {
  inspectorVersion: string;
  sessionId: string;
  server: ServerEntry;
  protocolVersion?: string;
  protocolEra?: ProtocolEra;
  serverInfo?: Implementation;
  serverCapabilities?: ServerCapabilities;
  clientCapabilities: ClientCapabilities;
  instructions?: string;
  tools: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
  prompts: unknown[];
  protocol: unknown[];
  network: unknown[];
  stderr: unknown[];
  console: unknown[];
  tasks: unknown[];
  subscriptions: unknown[];
  capturedAt?: string;
}

function jsonObject(value: unknown, label: string): ExtensionJsonObject {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new Error(`Cannot serialize ${label} for session export`, {
      cause: error,
    });
  }
  if (serialized === undefined) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`Cannot parse serialized ${label} for session export`, {
      cause: error,
    });
  }
  const result = ExtensionJsonObjectSchema.safeParse(parsed);
  if (!result.success) throw new z.ZodError(result.error.issues);
  return result.data;
}

function objectArray(values: unknown[], label: string): ExtensionJsonObject[] {
  return values.map((value, index) => jsonObject(value, `${label}[${index}]`));
}

/** Adapt live Web state into the shared serializable native-session DTO. */
export function createWebSessionSnapshot(
  context: WebSessionSnapshotContext,
): NativeSessionSnapshotInput {
  return NativeSessionSnapshotInputSchema.parse({
    inspectorVersion: context.inspectorVersion,
    capturedAt: context.capturedAt ?? new Date().toISOString(),
    sessionId: context.sessionId,
    server: {
      source: jsonObject(
        {
          id: context.server.id,
          name: context.server.name,
          config: context.server.config,
          settings: context.server.settings,
        },
        "server source",
      ),
      ...(context.protocolVersion !== undefined && {
        protocolVersion: context.protocolVersion,
      }),
      ...(context.protocolEra !== undefined && {
        protocolEra: context.protocolEra,
      }),
      implementation: jsonObject(
        context.serverInfo ?? {},
        "server implementation",
      ),
      capabilities: jsonObject(
        {
          server: context.serverCapabilities,
          client: context.clientCapabilities,
        },
        "capabilities",
      ),
      ...(context.instructions !== undefined && {
        instructions: context.instructions,
      }),
    },
    discovery: {
      tools: objectArray(context.tools, "tools"),
      resources: objectArray(context.resources, "resources"),
      resourceTemplates: objectArray(
        context.resourceTemplates,
        "resource templates",
      ),
      prompts: objectArray(context.prompts, "prompts"),
    },
    events: {
      protocol: objectArray(context.protocol, "protocol events"),
      network: objectArray(context.network, "network events"),
      stderr: objectArray(context.stderr, "stderr events"),
      console: objectArray(context.console, "console events"),
      tasks: objectArray(context.tasks, "task events"),
      subscriptions: objectArray(context.subscriptions, "subscription events"),
    },
  });
}
