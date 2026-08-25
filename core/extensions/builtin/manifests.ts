import type { ExtensionManifestCandidate } from "../registry/contributionRegistry.js";
import type { InspectorExtensionManifest } from "../manifest/schema.js";
import type { ArtifactOperationRequirements } from "../api/artifacts.js";
import {
  INSPECTOR_SESSION_ARTIFACT_VERSION,
  INSPECTOR_SESSION_FORMAT_ID,
  INSPECTOR_SESSION_MEDIA_TYPE,
} from "../api/sessions.js";
import {
  MCPDESC_0_7_ARTIFACT_VERSION,
  MCPDESC_0_7_EXTENSION_ID,
  MCPDESC_0_7_FORMAT_ID,
  MCPDESC_0_7_JSON_MEDIA_TYPE,
  MCPDESC_0_7_YAML_MEDIA_TYPE,
} from "./mcpdesc-0.7/constants.js";
import {
  MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
  MCPDESC_0_8_DRAFT_1_EXTENSION_ID,
  MCPDESC_0_8_DRAFT_1_FORMAT_ID,
  MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
  MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE,
} from "./mcpdesc-0.8-draft.1/constants.js";

export const MCP_INVOKE_COMMAND_ID = "modelcontextprotocol.mcp.invoke";
export const MCP_INVOKE_COMMAND_ALIAS = "mcp/invoke";
export const SERVERS_LIST_COMMAND_ID = "modelcontextprotocol.servers.list";
export const SERVERS_LIST_COMMAND_ALIAS = "servers/list";
export const SERVERS_SHOW_COMMAND_ID = "modelcontextprotocol.servers.show";
export const SERVERS_SHOW_COMMAND_ALIAS = "servers/show";

export const MCPDESC_0_7_EXPORT_REQUIREMENTS: ArtifactOperationRequirements = {
  dataRequirements: {
    serverDescription: "read",
    session: "none",
  },
  protocol: {
    negotiatedVersions: [
      "2024-11-05",
      "2025-03-26",
      "2025-06-18",
      "2025-11-25",
    ],
  },
};

export const MCPDESC_0_8_DRAFT_1_EXPORT_REQUIREMENTS: ArtifactOperationRequirements =
  {
    dataRequirements: {
      serverDescription: "read",
      session: "none",
    },
    protocol: {
      negotiatedVersions: [
        "2024-11-05",
        "2025-03-26",
        "2025-06-18",
        "2025-11-25",
        "2026-07-28",
      ],
    },
  };

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
        operationRequirements: {
          export: {
            dataRequirements: {
              serverDescription: "none",
              session: "read",
            },
          },
          validate: {
            dataRequirements: {
              serverDescription: "none",
              session: "none",
            },
          },
        },
      },
    ],
  },
};

export const MCPDESC_0_7_BUILTIN_MANIFEST: InspectorExtensionManifest = {
  id: MCPDESC_0_7_EXTENSION_ID,
  displayName: "MCP Description 0.7 Artifact",
  version: "0.1.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  activationEvents: [
    `onArtifactExport:${MCPDESC_0_7_FORMAT_ID}`,
    `onArtifactValidate:${MCPDESC_0_7_FORMAT_ID}`,
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
    artifactFormats: [
      {
        id: MCPDESC_0_7_FORMAT_ID,
        displayName: "MCP Description 0.7",
        artifactVersion: MCPDESC_0_7_ARTIFACT_VERSION,
        mediaTypes: [MCPDESC_0_7_JSON_MEDIA_TYPE, MCPDESC_0_7_YAML_MEDIA_TYPE],
        encodings: ["json", "yaml"],
        operationRequirements: {
          export: {
            ...MCPDESC_0_7_EXPORT_REQUIREMENTS,
          },
          validate: {
            dataRequirements: {
              serverDescription: "none",
              session: "none",
            },
          },
        },
      },
    ],
  },
};

export const MCPDESC_0_8_DRAFT_1_BUILTIN_MANIFEST: InspectorExtensionManifest =
  {
    id: MCPDESC_0_8_DRAFT_1_EXTENSION_ID,
    displayName: "MCP Description 0.8.0 Draft 1 Artifact",
    version: "0.1.0",
    engines: {
      inspector: ">=2.2.0",
      extensionApi: "^0.1.0",
    },
    activationEvents: [
      `onArtifactExport:${MCPDESC_0_8_DRAFT_1_FORMAT_ID}`,
      `onArtifactValidate:${MCPDESC_0_8_DRAFT_1_FORMAT_ID}`,
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
      artifactFormats: [
        {
          id: MCPDESC_0_8_DRAFT_1_FORMAT_ID,
          displayName: "MCP Description 0.8.0 Draft 1",
          artifactVersion: MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION,
          mediaTypes: [
            MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE,
            MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE,
          ],
          encodings: ["json", "yaml"],
          operationRequirements: {
            export: {
              ...MCPDESC_0_8_DRAFT_1_EXPORT_REQUIREMENTS,
            },
            validate: {
              dataRequirements: {
                serverDescription: "none",
                session: "none",
              },
            },
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
    { manifest: MCPDESC_0_7_BUILTIN_MANIFEST, source: "builtin" },
    { manifest: MCPDESC_0_8_DRAFT_1_BUILTIN_MANIFEST, source: "builtin" },
  ];
