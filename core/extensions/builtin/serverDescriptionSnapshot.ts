import { z } from "zod";
import type {
  Implementation,
  ProtocolEra,
  ServerCapabilities,
} from "@modelcontextprotocol/client";
import type { ExcludedTool, MCPServerConfig } from "../../mcp/types.js";
import type { ArtifactDiagnostic } from "../api/artifacts.js";
import {
  ExtensionJsonObjectSchema,
  type ExtensionJsonObject,
} from "../api/json.js";
import {
  ServerDescriptionSnapshotSchema,
  type ServerDescriptionSnapshot,
  type ServerDescriptionTransportSource,
} from "../api/serverDescription.js";

interface ServerDescriptionClientSource {
  getProtocolVersion(): string | undefined;
  getProtocolEra(): ProtocolEra | undefined;
  getServerInfo(): Implementation | undefined;
  getCapabilities(): ServerCapabilities | undefined;
  getInstructions(): string | undefined;
  getExcludedTools(): ExcludedTool[];
  listAllTools(options: { cacheMode: "bypass" }): Promise<{ tools: unknown[] }>;
  listAllResources(options: {
    cacheMode: "bypass";
  }): Promise<{ resources: unknown[] }>;
  listAllResourceTemplates(options: {
    cacheMode: "bypass";
  }): Promise<{ resourceTemplates: unknown[] }>;
  listAllPrompts(options: {
    cacheMode: "bypass";
  }): Promise<{ prompts: unknown[] }>;
}

export interface ServerDescriptionSnapshotContext {
  client: ServerDescriptionClientSource;
  serverConfig: MCPServerConfig;
  capturedAt?: string;
}

function jsonObject(value: unknown, label: string): ExtensionJsonObject {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new Error(`Cannot serialize ${label} for server description export`, {
      cause: error,
    });
  }
  if (serialized === undefined) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(
      `Cannot parse serialized ${label} for server description export`,
      { cause: error },
    );
  }
  const result = ExtensionJsonObjectSchema.safeParse(parsed);
  if (!result.success) throw new z.ZodError(result.error.issues);
  return result.data;
}

function objectArray(values: unknown[], label: string): ExtensionJsonObject[] {
  return values.map((value, index) => jsonObject(value, `${label}[${index}]`));
}

function transportDiagnostic(message: string): ArtifactDiagnostic {
  return {
    code: "artifact.source-field-omitted",
    severity: "warning",
    message,
    path: ["transport"],
  };
}

function safeRemoteUrl(value: string): {
  url: string;
  diagnostic?: ArtifactDiagnostic;
} {
  const url = new URL(value);
  const omitted =
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "";
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      "Server description export supports only HTTP(S) remote transport URLs",
    );
  }
  return {
    url: url.href,
    ...(omitted && {
      diagnostic: transportDiagnostic(
        "Credentials, query parameters, and fragments were omitted from the exported transport URL",
      ),
    }),
  };
}

function safeTransport(config: MCPServerConfig): {
  transport: ServerDescriptionTransportSource;
  diagnostics: ArtifactDiagnostic[];
} {
  if (!("url" in config)) {
    const diagnostics =
      config.args !== undefined && config.args.length > 0
        ? [
            transportDiagnostic(
              "stdio arguments were omitted because command arguments can contain secrets",
            ),
          ]
        : [];
    return {
      transport: { type: "stdio", command: config.command },
      diagnostics,
    };
  }

  const sanitized = safeRemoteUrl(config.url);
  return {
    transport: { type: config.type, url: sanitized.url },
    diagnostics:
      sanitized.diagnostic === undefined ? [] : [sanitized.diagnostic],
  };
}

function excludedToolDiagnostics(
  excludedTools: ExcludedTool[],
): ArtifactDiagnostic[] {
  return excludedTools.map(({ tool, reason }, index) => ({
    code: "artifact.tool-excluded",
    severity: "warning",
    message: `Tool ${JSON.stringify(tool.name)} was excluded: ${reason}`,
    path: ["tools", index],
  }));
}

/**
 * Collect a fresh, capability-gated server description. Supported list calls
 * run in parallel and bypass the SDK response cache. Any advertised-list
 * failure rejects the entire collection so no misleading partial artifact is
 * written.
 */
export async function collectServerDescriptionSnapshot(
  context: ServerDescriptionSnapshotContext,
): Promise<ServerDescriptionSnapshot> {
  const { client } = context;
  const capabilities = client.getCapabilities();
  if (capabilities === undefined) {
    throw new Error("The connected server did not provide capabilities");
  }
  const protocolVersion = client.getProtocolVersion();
  const protocolEra = client.getProtocolEra();
  const serverInfo = client.getServerInfo();
  const instructions = client.getInstructions();

  const [toolsResult, resourcesResult, templatesResult, promptsResult] =
    await Promise.all([
      capabilities.tools
        ? client.listAllTools({ cacheMode: "bypass" })
        : Promise.resolve({ tools: [] }),
      capabilities.resources
        ? client.listAllResources({ cacheMode: "bypass" })
        : Promise.resolve({ resources: [] }),
      capabilities.resources
        ? client.listAllResourceTemplates({ cacheMode: "bypass" })
        : Promise.resolve({ resourceTemplates: [] }),
      capabilities.prompts
        ? client.listAllPrompts({ cacheMode: "bypass" })
        : Promise.resolve({ prompts: [] }),
    ]);

  const safe = safeTransport(context.serverConfig);
  return ServerDescriptionSnapshotSchema.parse({
    capturedAt: context.capturedAt ?? new Date().toISOString(),
    ...(protocolVersion !== undefined && {
      protocolVersion,
    }),
    ...(protocolEra !== undefined && {
      protocolEra,
    }),
    serverInfo: jsonObject(serverInfo ?? {}, "server info"),
    capabilities: jsonObject(capabilities, "server capabilities"),
    ...(instructions !== undefined && {
      instructions,
    }),
    transport: safe.transport,
    tools: objectArray(toolsResult.tools, "tools"),
    resources: objectArray(resourcesResult.resources, "resources"),
    resourceTemplates: objectArray(
      templatesResult.resourceTemplates,
      "resource templates",
    ),
    prompts: objectArray(promptsResult.prompts, "prompts"),
    diagnostics: [
      ...safe.diagnostics,
      ...excludedToolDiagnostics(client.getExcludedTools()),
    ],
  });
}
