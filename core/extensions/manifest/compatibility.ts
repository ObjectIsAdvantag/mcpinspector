import { satisfies } from "semver";
import type { ExtensionDiagnostic } from "../api/diagnostics.js";
import type { InspectorExtensionManifest } from "./schema.js";

export type ExtensionRuntime = "node" | "browser";

export interface ExtensionHostCompatibility {
  inspectorVersion: string;
  extensionApiVersion: string;
  runtime?: ExtensionRuntime;
}

function incompatibility(
  manifest: InspectorExtensionManifest,
  code: "extension.inspector-incompatible" | "extension.api-incompatible",
  engine: "inspector" | "extensionApi",
  actualVersion: string,
): ExtensionDiagnostic {
  return {
    code,
    extensionId: manifest.id,
    path: ["engines", engine],
    message: `${manifest.id} requires ${engine} ${manifest.engines[engine]}, but the host provides ${actualVersion}`,
  };
}

export function checkManifestCompatibility(
  manifest: InspectorExtensionManifest,
  host: ExtensionHostCompatibility,
): ExtensionDiagnostic[] {
  const diagnostics: ExtensionDiagnostic[] = [];
  if (!satisfies(host.inspectorVersion, manifest.engines.inspector)) {
    diagnostics.push(
      incompatibility(
        manifest,
        "extension.inspector-incompatible",
        "inspector",
        host.inspectorVersion,
      ),
    );
  }
  if (!satisfies(host.extensionApiVersion, manifest.engines.extensionApi)) {
    diagnostics.push(
      incompatibility(
        manifest,
        "extension.api-incompatible",
        "extensionApi",
        host.extensionApiVersion,
      ),
    );
  }
  if (
    host.runtime !== undefined &&
    manifest.entrypoints?.[host.runtime] === undefined
  ) {
    diagnostics.push({
      code: "extension.runtime-unavailable",
      extensionId: manifest.id,
      path: ["entrypoints", host.runtime],
      message: `${manifest.id} has no ${host.runtime} entrypoint`,
    });
  }
  return diagnostics;
}
