import { z } from "zod";
import type {
  FetchRequestEntry,
  MessageEntry,
  StderrLogEntry,
} from "@inspector/core/mcp/index.js";
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
import type { NativeSessionSnapshotInput } from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import { NativeSessionSnapshotInputSchema } from "@inspector/core/extensions/builtin/inspector-session/snapshot.js";
import type { MethodArgs, MethodOutcome } from "../../handlers/method-types.js";
import type {
  InspectorServerSettings,
  MCPServerConfig,
} from "@inspector/core/mcp/types.js";

interface CliSessionClientSnapshotSource {
  getProtocolVersion(): string | undefined;
  getProtocolEra(): ProtocolEra | undefined;
  getServerInfo(): Implementation | undefined;
  getCapabilities(): ServerCapabilities | undefined;
  getClientCapabilities(): ClientCapabilities;
  getInstructions(): string | undefined;
}

interface CliSessionEventSnapshotSource {
  messages: { getMessages(): MessageEntry[] };
  network: { getFetchRequests(): FetchRequestEntry[] };
  stderr: { getStderrLogs(): StderrLogEntry[] };
}

export interface CliSessionSnapshotContext extends CliSessionEventSnapshotSource {
  inspectorVersion: string;
  sessionId: string;
  serverName?: string;
  serverConfig: MCPServerConfig;
  serverSettings?: InspectorServerSettings;
  client: CliSessionClientSnapshotSource;
  methodArgs: MethodArgs & { method: string };
  outcome: MethodOutcome;
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
  if (!result.success) {
    throw new z.ZodError(result.error.issues);
  }
  return result.data;
}

function objectArray(value: unknown, label: string): ExtensionJsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => jsonObject(entry, `${label}[${index}]`));
}

function discoveryFromOutcome(
  outcome: MethodOutcome,
): NativeSessionSnapshotInput["discovery"] {
  if (outcome.kind === "ndjson") {
    return { tools: objectArray(outcome.lines, "tool app information") };
  }
  if (outcome.kind !== "result") return {};
  const result = outcome.result;
  return {
    tools: objectArray(result.tools, "tools"),
    resources: objectArray(result.resources, "resources"),
    resourceTemplates: objectArray(
      result.resourceTemplates,
      "resource templates",
    ),
    prompts: objectArray(result.prompts, "prompts"),
  };
}

function outcomeObject(outcome: MethodOutcome): ExtensionJsonObject {
  if (outcome.kind === "result") {
    return jsonObject(
      { kind: outcome.kind, result: outcome.result, appInfo: outcome.appInfo },
      "method result",
    );
  }
  if (outcome.kind === "ndjson") {
    return jsonObject(outcome, "method result");
  }
  return { kind: outcome.kind, label: outcome.label };
}

/** Adapt one live CLI invocation into the shared serializable snapshot DTO. */
export function createCliSessionSnapshot(
  context: CliSessionSnapshotContext,
): NativeSessionSnapshotInput {
  const candidate = {
    inspectorVersion: context.inspectorVersion,
    capturedAt: context.capturedAt ?? new Date().toISOString(),
    sessionId: context.sessionId,
    server: {
      source: jsonObject(
        {
          name: context.serverName,
          config: context.serverConfig,
          settings: context.serverSettings,
        },
        "server source",
      ),
      ...(context.client.getProtocolVersion() !== undefined && {
        protocolVersion: context.client.getProtocolVersion(),
      }),
      ...(context.client.getProtocolEra() !== undefined && {
        protocolEra: context.client.getProtocolEra(),
      }),
      implementation: jsonObject(
        context.client.getServerInfo() ?? {},
        "server implementation",
      ),
      capabilities: jsonObject(
        {
          server: context.client.getCapabilities(),
          client: context.client.getClientCapabilities(),
        },
        "capabilities",
      ),
      ...(context.client.getInstructions() !== undefined && {
        instructions: context.client.getInstructions(),
      }),
    },
    discovery: discoveryFromOutcome(context.outcome),
    events: {
      protocol: objectArray(context.messages.getMessages(), "protocol events"),
      network: objectArray(
        context.network.getFetchRequests(),
        "network events",
      ),
      stderr: objectArray(context.stderr.getStderrLogs(), "stderr events"),
    },
    invocation: {
      method: context.methodArgs.method,
      arguments: jsonObject(context.methodArgs, "method arguments"),
      outcome: outcomeObject(context.outcome),
    },
  };
  return NativeSessionSnapshotInputSchema.parse(candidate);
}
