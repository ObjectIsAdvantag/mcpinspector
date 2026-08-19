import type { ExtensionManifestCandidate } from "../registry/contributionRegistry.js";
import type { InspectorExtensionManifest } from "../manifest/schema.js";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  INSPECTOR_SESSION_MEDIA_TYPE,
} from "../api/sessions.js";

export const MCP_INVOKE_COMMAND_ID = "modelcontextprotocol.mcp.invoke";
export const MCP_INVOKE_COMMAND_ALIAS = "mcp/invoke";
export const SERVERS_LIST_COMMAND_ID = "modelcontextprotocol.servers.list";
export const SERVERS_LIST_COMMAND_ALIAS = "servers/list";
export const SERVERS_SHOW_COMMAND_ID = "modelcontextprotocol.servers.show";
export const SERVERS_SHOW_COMMAND_ALIAS = "servers/show";

export const INSPECTOR_SESSION_BUILTIN_MANIFEST: InspectorExtensionManifest = {
  id: "modelcontextprotocol.inspector-session",
  displayName: "Inspector Native Session Artifact",
  version: "0.1.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  activationEvents: [
    `onArtifactExport:${INSPECTOR_SESSION_FORMAT_ID}`,
    `onArtifactValidate:${INSPECTOR_SESSION_FORMAT_ID}`,
  ],
  capabilities: {
    serverData: "read",
    sessionData: "read",
    filesystem: "none",
    network: false,
    processExecution: false,
    secrets: false,
  },
  contributes: {
    artifactFormats: [
      {
        id: INSPECTOR_SESSION_FORMAT_ID,
        displayName: "Inspector Session",
        artifactVersion: INSPECTOR_SESSION_ARTIFACT_VERSION,
        mediaTypes: [INSPECTOR_SESSION_MEDIA_TYPE],
        encodings: ["json"],
        operations: ["export", "validate"],
        dataRequirements: {
          serverDescription: "none",
          session: "read",
        },
      },
    ],
  },
};

export const MCP_BUILTIN_MANIFEST: InspectorExtensionManifest = {
  id: "modelcontextprotocol.mcp",
  displayName: "Inspector MCP Invocation Command",
  version: "0.1.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  activationEvents: [`onCommand:${MCP_INVOKE_COMMAND_ID}`],
  capabilities: {
    serverData: "read",
    sessionData: "none",
    filesystem: "none",
    network: false,
    processExecution: false,
    secrets: false,
  },
  contributes: {
    commands: [
      {
        id: MCP_INVOKE_COMMAND_ID,
        aliases: [MCP_INVOKE_COMMAND_ALIAS],
        title: "Invoke an MCP method",
        connection: "connected",
        serverSelection: "exactly-one",
      },
    ],
  },
};

export const SERVERS_BUILTIN_MANIFEST: InspectorExtensionManifest = {
  id: "modelcontextprotocol.servers",
  displayName: "Inspector Server Catalog Commands",
  version: "0.1.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  activationEvents: [
    `onCommand:${SERVERS_LIST_COMMAND_ID}`,
    `onCommand:${SERVERS_SHOW_COMMAND_ID}`,
  ],
  capabilities: {
    serverData: "read",
    sessionData: "none",
    filesystem: "none",
    network: false,
    processExecution: false,
    secrets: false,
  },
  contributes: {
    commands: [
      {
        id: SERVERS_LIST_COMMAND_ID,
        aliases: [SERVERS_LIST_COMMAND_ALIAS],
        title: "List configured servers",
        connection: "none",
        serverSelection: "all",
      },
      {
        id: SERVERS_SHOW_COMMAND_ID,
        aliases: [SERVERS_SHOW_COMMAND_ALIAS],
        title: "Show a configured server",
        connection: "resolved",
        serverSelection: "exactly-one",
      },
    ],
  },
};

export const BUILTIN_EXTENSION_MANIFESTS: readonly ExtensionManifestCandidate[] =
  [
    { manifest: MCP_BUILTIN_MANIFEST, source: "builtin" },
    { manifest: SERVERS_BUILTIN_MANIFEST, source: "builtin" },
    { manifest: INSPECTOR_SESSION_BUILTIN_MANIFEST, source: "builtin" },
  ];
