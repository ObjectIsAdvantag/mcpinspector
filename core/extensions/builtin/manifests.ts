import type { ExtensionManifestCandidate } from "../registry/contributionRegistry.js";
import type { InspectorExtensionManifest } from "../manifest/schema.js";

export const SERVERS_BUILTIN_MANIFEST: InspectorExtensionManifest = {
  id: "modelcontextprotocol.servers",
  displayName: "Inspector Server Catalog Commands",
  version: "0.1.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  activationEvents: [
    "onCommand:modelcontextprotocol.servers.list",
    "onCommand:modelcontextprotocol.servers.show",
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
        id: "modelcontextprotocol.servers.list",
        title: "List configured servers",
        connection: "none",
        serverSelection: "all",
      },
      {
        id: "modelcontextprotocol.servers.show",
        title: "Show a configured server",
        connection: "resolved",
        serverSelection: "exactly-one",
      },
    ],
  },
};

export const BUILTIN_EXTENSION_MANIFESTS: readonly ExtensionManifestCandidate[] =
  [{ manifest: SERVERS_BUILTIN_MANIFEST, source: "builtin" }];
