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

function duplicateCommandSelectorDiagnostic(
  extensionId: string,
  contributionId: string,
  selector: string,
): ExtensionDiagnostic {
  return {
    code: "extension.duplicate-command-selector",
    extensionId,
    contributionId,
    path: ["contributes", "commands"],
    message: `Duplicate command selector: ${selector}`,
  };
}

/** Resolve a canonical command id or one of its declared aliases. */
export function resolveCommandContribution(
  catalog: StaticContributionCatalog,
  selector: string,
): RegisteredContribution<CommandContribution> | undefined {
  return catalog.commands.find(
    ({ contribution }) =>
      contribution.id === selector ||
      contribution.aliases?.includes(selector) === true,
  );
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
  const commandSelectors = new Set<string>();

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

    const duplicateSelector = commands
      .flatMap((command) => [command.id, ...(command.aliases ?? [])])
      .find((selector) => commandSelectors.has(selector));
    if (duplicateSelector !== undefined) {
      const command = commands.find(
        ({ id, aliases }) =>
          id === duplicateSelector || aliases?.includes(duplicateSelector),
      );
      catalog.diagnostics.push(
        duplicateCommandSelectorDiagnostic(
          manifest.id,
          command!.id,
          duplicateSelector,
        ),
      );
      continue;
    }

    extensionIds.add(manifest.id);
    for (const command of commands) {
      contributionIds.add(command.id);
      commandSelectors.add(command.id);
      for (const alias of command.aliases ?? []) {
        commandSelectors.add(alias);
      }
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
