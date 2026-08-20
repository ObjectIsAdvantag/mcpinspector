import type { z } from "zod";
import {
  artifactDiagnosticPath,
  type ArtifactDiagnostic,
} from "../../api/artifacts.js";
import {
  ServerDescriptionSnapshotSchema,
  type ServerDescriptionSnapshot,
  type ServerDescriptionTransportSource,
} from "../../api/serverDescription.js";
import type {
  ExtensionJsonObject,
  ExtensionJsonValue,
} from "../../api/json.js";
import {
  MCPDESC_0_7_ARTIFACT_VERSION,
  MCPDESC_0_7_SCHEMA_URI,
} from "./constants.js";
import { validateMcpDescription07Document } from "./validation.js";

export interface McpDescription07BuildSuccess {
  ok: true;
  document: ExtensionJsonObject;
  diagnostics: ArtifactDiagnostic[];
}

export interface McpDescription07BuildFailure {
  ok: false;
  diagnostics: ArtifactDiagnostic[];
}

export type McpDescription07BuildResult =
  | McpDescription07BuildSuccess
  | McpDescription07BuildFailure;

function hasOwn(source: ExtensionJsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function asObject(value: ExtensionJsonValue): ExtensionJsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function copyAllowedFields(
  source: ExtensionJsonObject,
  target: ExtensionJsonObject,
  fields: readonly string[],
): void {
  for (const field of fields) {
    if (hasOwn(source, field)) target[field] = source[field];
  }
}

function mapStrictObject(
  value: ExtensionJsonValue,
  mapper: (source: ExtensionJsonObject) => ExtensionJsonObject,
): ExtensionJsonValue {
  const source = asObject(value);
  return source === undefined ? value : mapper(source);
}

function mapStrictArray(
  value: ExtensionJsonValue,
  mapper: (item: ExtensionJsonValue) => ExtensionJsonValue,
): ExtensionJsonValue {
  return Array.isArray(value) ? value.map(mapper) : value;
}

function copyMappedField(
  source: ExtensionJsonObject,
  target: ExtensionJsonObject,
  field: string,
  mapper: (value: ExtensionJsonValue) => ExtensionJsonValue,
): void {
  if (hasOwn(source, field)) target[field] = mapper(source[field]);
}

function mapIcon(source: ExtensionJsonObject): ExtensionJsonObject {
  const icon: ExtensionJsonObject = {};
  copyAllowedFields(source, icon, ["src", "mimeType", "sizes", "theme"]);
  return icon;
}

function mapIcons(value: ExtensionJsonValue): ExtensionJsonValue {
  return mapStrictArray(value, (icon) => mapStrictObject(icon, mapIcon));
}

function mapExecution(source: ExtensionJsonObject): ExtensionJsonObject {
  const execution: ExtensionJsonObject = {};
  copyAllowedFields(source, execution, ["taskSupport"]);
  return execution;
}

function mapTool(source: ExtensionJsonObject): ExtensionJsonObject {
  const tool: ExtensionJsonObject = {};
  copyAllowedFields(source, tool, [
    "name",
    "title",
    "description",
    // These four fields deliberately preserve their complete JSON objects:
    // the authoritative schema explicitly permits additional properties.
    "inputSchema",
    "outputSchema",
    "annotations",
    "_meta",
    "tags",
    "deprecated",
  ]);
  copyMappedField(source, tool, "execution", (execution) =>
    mapStrictObject(execution, mapExecution),
  );
  copyMappedField(source, tool, "icons", mapIcons);
  return tool;
}

function mapResource(source: ExtensionJsonObject): ExtensionJsonObject {
  const resource: ExtensionJsonObject = {};
  copyAllowedFields(source, resource, [
    "uri",
    "name",
    "title",
    "description",
    "mimeType",
    "size",
    // The authoritative schema explicitly permits arbitrary annotation and
    // protocol metadata properties.
    "annotations",
    "_meta",
    "tags",
    "deprecated",
  ]);
  copyMappedField(source, resource, "icons", mapIcons);
  return resource;
}

function mapResourceTemplate(source: ExtensionJsonObject): ExtensionJsonObject {
  const template: ExtensionJsonObject = {};
  copyAllowedFields(source, template, [
    "uriTemplate",
    "name",
    "title",
    "description",
    "mimeType",
    "annotations",
    "_meta",
    "tags",
    "deprecated",
  ]);
  copyMappedField(source, template, "icons", mapIcons);
  return template;
}

function mapPromptArgument(source: ExtensionJsonObject): ExtensionJsonObject {
  const argument: ExtensionJsonObject = {};
  copyAllowedFields(source, argument, [
    "name",
    "title",
    "description",
    "required",
  ]);
  return argument;
}

function mapPromptArguments(value: ExtensionJsonValue): ExtensionJsonValue {
  return mapStrictArray(value, (argument) =>
    mapStrictObject(argument, mapPromptArgument),
  );
}

function mapPrompt(source: ExtensionJsonObject): ExtensionJsonObject {
  const prompt: ExtensionJsonObject = {};
  copyAllowedFields(source, prompt, [
    "name",
    "title",
    "description",
    "_meta",
    "tags",
    "deprecated",
  ]);
  copyMappedField(source, prompt, "arguments", mapPromptArguments);
  copyMappedField(source, prompt, "icons", mapIcons);
  return prompt;
}

function mapInfo(snapshot: ServerDescriptionSnapshot): ExtensionJsonObject {
  const info: ExtensionJsonObject = {};
  if (snapshot.serverInfo !== undefined) {
    copyAllowedFields(snapshot.serverInfo, info, [
      "name",
      "title",
      "description",
      "version",
      "websiteUrl",
    ]);
    copyMappedField(snapshot.serverInfo, info, "icons", mapIcons);
  }
  if (snapshot.protocolVersion !== undefined) {
    info.protocolVersion = snapshot.protocolVersion;
  }
  return info;
}

function mapTransport(
  source: ServerDescriptionTransportSource,
): ExtensionJsonObject {
  if (source.type === "stdio") {
    return {
      type: source.type,
      command: source.command,
    };
  }
  return { type: source.type, url: source.url };
}

function addNonEmptySurface(
  document: ExtensionJsonObject,
  name: string,
  source: ExtensionJsonObject[],
  mapper: (item: ExtensionJsonObject) => ExtensionJsonObject,
): void {
  if (source.length > 0) document[name] = source.map(mapper);
}

function snapshotSchemaDiagnostics(error: z.ZodError): ArtifactDiagnostic[] {
  return error.issues.map((issue) => ({
    code: "artifact.snapshot-invalid",
    severity: "error",
    message: issue.message,
    path: artifactDiagnosticPath(issue.path),
  }));
}

function noSurfaceDiagnostic(): ArtifactDiagnostic {
  return {
    code: "artifact.no-discovered-surface",
    severity: "error",
    message:
      "MCP Description 0.7 requires at least one non-empty tools, resources, resourceTemplates, or prompts list",
    path: [],
  };
}

function instructionsDiagnostic(): ArtifactDiagnostic {
  return {
    code: "artifact.source-field-unsupported",
    severity: "info",
    message:
      "MCP Description 0.7 has no server instructions field; instructions were omitted",
    path: ["instructions"],
  };
}

/** Project a host snapshot through the MCP Description 0.7 allowlist. */
export function buildMcpDescription07Document(
  input: unknown,
): McpDescription07BuildResult {
  const parsed = ServerDescriptionSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      diagnostics: snapshotSchemaDiagnostics(parsed.error),
    };
  }

  const snapshot = parsed.data;
  const diagnostics = [...snapshot.diagnostics];
  if (snapshot.instructions !== undefined) {
    diagnostics.push(instructionsDiagnostic());
  }
  if (
    snapshot.tools.length === 0 &&
    snapshot.resources.length === 0 &&
    snapshot.resourceTemplates.length === 0 &&
    snapshot.prompts.length === 0
  ) {
    return { ok: false, diagnostics: [...diagnostics, noSurfaceDiagnostic()] };
  }

  const document: ExtensionJsonObject = {
    $schema: MCPDESC_0_7_SCHEMA_URI,
    mcpdesc: MCPDESC_0_7_ARTIFACT_VERSION,
    info: mapInfo(snapshot),
    transports: [mapTransport(snapshot.transport)],
  };
  if (
    snapshot.capabilities !== undefined &&
    Object.keys(snapshot.capabilities).length > 0
  ) {
    // This broad copy is intentional and limited to the one schema location
    // whose authoritative definition declares `additionalProperties: true`.
    document.capabilities = snapshot.capabilities;
  }
  addNonEmptySurface(document, "tools", snapshot.tools, mapTool);
  addNonEmptySurface(document, "resources", snapshot.resources, mapResource);
  addNonEmptySurface(
    document,
    "resourceTemplates",
    snapshot.resourceTemplates,
    mapResourceTemplate,
  );
  addNonEmptySurface(document, "prompts", snapshot.prompts, mapPrompt);

  const validationDiagnostics = validateMcpDescription07Document(document);
  if (validationDiagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: [...diagnostics, ...validationDiagnostics],
    };
  }
  return { ok: true, document, diagnostics };
}
