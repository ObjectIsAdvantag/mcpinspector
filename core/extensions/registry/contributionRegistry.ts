import type { ArtifactFormatContribution } from "../api/artifacts.js";
import type { CommandContribution } from "../api/commands.js";
import type { ExtensionDiagnostic } from "../api/diagnostics.js";
import {
  checkManifestCompatibility,
  type ExtensionHostCompatibility,
} from "../manifest/compatibility.js";
import { parseExtensionManifest } from "../manifest/parse.js";
import type { InspectorExtensionManifest } from "../manifest/schema.js";

export type ExtensionSource = "builtin" | "external";

export interface ExtensionManifestCandidate {
  manifest: unknown;
  source: ExtensionSource;
}

export interface CatalogExtension {
  manifest: InspectorExtensionManifest;
  source: ExtensionSource;
}

export interface RegisteredContribution<TContribution> {
  extensionId: string;
  contribution: TContribution;
}

export interface StaticContributionCatalog {
  extensions: CatalogExtension[];
  commands: Array<RegisteredContribution<CommandContribution>>;
  artifactFormats: Array<RegisteredContribution<ArtifactFormatContribution>>;
  diagnostics: ExtensionDiagnostic[];
}

function duplicateExtensionDiagnostic(
  extensionId: string,
): ExtensionDiagnostic {
  return {
    code: "extension.duplicate-id",
    extensionId,
    path: ["id"],
    message: `Duplicate extension id: ${extensionId}`,
  };
}

function duplicateContributionDiagnostic(
  extensionId: string,
  contributionId: string,
): ExtensionDiagnostic {
  return {
    code: "extension.duplicate-contribution-id",
    extensionId,
    contributionId,
    path: ["contributes"],
    message: `Duplicate contribution id: ${contributionId}`,
  };
}

/**
 * Build an immutable-by-convention catalog from static manifest data. This
 * function validates metadata only and never imports an extension entrypoint.
 */
export function createStaticContributionCatalog(
  candidates: readonly ExtensionManifestCandidate[],
  host: ExtensionHostCompatibility,
): StaticContributionCatalog {
  const catalog: StaticContributionCatalog = {
    extensions: [],
    commands: [],
    artifactFormats: [],
    diagnostics: [],
  };
  const extensionIds = new Set<string>();
  const contributionIds = new Set<string>();

  for (const candidate of candidates) {
    const parsed = parseExtensionManifest(candidate.manifest);
    if (!parsed.ok) {
      catalog.diagnostics.push(...parsed.diagnostics);
      continue;
    }

    const { manifest } = parsed;
    if (extensionIds.has(manifest.id)) {
      catalog.diagnostics.push(duplicateExtensionDiagnostic(manifest.id));
      continue;
    }

    const compatibility = checkManifestCompatibility(manifest, host);
    if (compatibility.length > 0) {
      catalog.diagnostics.push(...compatibility);
      continue;
    }

    const commands = manifest.contributes.commands ?? [];
    const artifactFormats = manifest.contributes.artifactFormats ?? [];
    const duplicateId = [...commands, ...artifactFormats]
      .map(({ id }) => id)
      .find((id) => contributionIds.has(id));
    if (duplicateId !== undefined) {
      catalog.diagnostics.push(
        duplicateContributionDiagnostic(manifest.id, duplicateId),
      );
      continue;
    }

    extensionIds.add(manifest.id);
    for (const command of commands) {
      contributionIds.add(command.id);
      catalog.commands.push({
        extensionId: manifest.id,
        contribution: command,
      });
    }
    for (const artifactFormat of artifactFormats) {
      contributionIds.add(artifactFormat.id);
      catalog.artifactFormats.push({
        extensionId: manifest.id,
        contribution: artifactFormat,
      });
    }
    catalog.extensions.push({ manifest, source: candidate.source });
  }

  return catalog;
}
