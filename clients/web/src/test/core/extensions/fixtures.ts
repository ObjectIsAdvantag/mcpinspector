import type { InspectorExtensionManifest } from "@inspector/core/extensions/manifest/schema.js";

export const VALID_MANIFEST: InspectorExtensionManifest = {
  id: "example.mcpdesc",
  displayName: "MCP Description",
  version: "1.0.0",
  engines: {
    inspector: ">=2.2.0",
    extensionApi: "^0.1.0",
  },
  entrypoints: {
    node: "./dist/node/extension.js",
    browser: "./dist/browser/extension.js",
  },
  activationEvents: ["onArtifactExport:example.mcpdesc-0.7"],
  capabilities: {
    serverData: "read",
    sessionData: "none",
    filesystem: "output-only",
    network: false,
    processExecution: false,
    secrets: false,
  },
  contributes: {
    commands: [
      {
        id: "example.commands.inspect",
        aliases: ["commands/inspect"],
        title: "Inspect a server",
        connection: "connected",
        serverSelection: "exactly-one",
        optionsSchema: {
          type: "object",
          properties: { fresh: { type: "boolean" } },
        },
      },
    ],
    artifactFormats: [
      {
        id: "example.mcpdesc-0.7",
        displayName: "MCP Description 0.7",
        artifactVersion: "0.7",
        mediaTypes: ["application/json", "application/yaml"],
        encodings: ["json", "yaml"],
        operations: ["export", "validate"],
        dataRequirements: {
          serverDescription: "read",
          session: "none",
        },
      },
    ],
  },
};

export const INVALID_MANIFEST = {
  ...VALID_MANIFEST,
  id: "Invalid ID",
  version: "latest",
  entrypoints: { node: "../escape.js" },
};

export const INCOMPATIBLE_MANIFEST: InspectorExtensionManifest = {
  ...VALID_MANIFEST,
  id: "example.future",
  engines: { inspector: ">=999.0.0", extensionApi: "^99.0.0" },
  activationEvents: [],
  contributes: {},
};

export const NODE_ONLY_MANIFEST: InspectorExtensionManifest = {
  ...VALID_MANIFEST,
  id: "example.node-only",
  entrypoints: { node: "./dist/node/extension.js" },
  activationEvents: [],
  contributes: {},
};

export const BROWSER_ONLY_MANIFEST: InspectorExtensionManifest = {
  ...VALID_MANIFEST,
  id: "example.browser-only",
  entrypoints: { browser: "./dist/browser/extension.js" },
  activationEvents: [],
  contributes: {},
};

/** Reserved identity fixture only; it must never enter the production catalog. */
export const PLANNED_MCPDESC_08_MANIFEST: InspectorExtensionManifest = {
  ...VALID_MANIFEST,
  id: "modelcontextprotocol.mcpdesc",
  engines: { inspector: ">=999.0.0", extensionApi: "^99.0.0" },
  activationEvents: ["onArtifactExport:modelcontextprotocol.mcpdesc-0.8"],
  contributes: {
    artifactFormats: [
      {
        id: "modelcontextprotocol.mcpdesc-0.8",
        displayName: "MCP Description 0.8 (unavailable)",
        artifactVersion: "0.8",
        mediaTypes: ["application/json"],
        encodings: ["json"],
        operations: ["export"],
        dataRequirements: {
          serverDescription: "read",
          session: "none",
        },
      },
    ],
  },
};
