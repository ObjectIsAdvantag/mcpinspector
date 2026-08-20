import { createBuiltinContributionCatalog } from "@inspector/core/extensions/builtin/catalog.js";
import {
  resolveArtifactContribution,
  resolveCommandContribution,
  type RegisteredContribution,
  type StaticContributionCatalog,
} from "@inspector/core/extensions/registry/contributionRegistry.js";
import type { CommandContribution } from "@inspector/core/extensions/api/commands.js";
import type { ArtifactFormatContribution } from "@inspector/core/extensions/api/artifacts.js";
import { INSPECTOR_SESSION_FORMAT_ID } from "@inspector/core/extensions/api/sessions.js";
import { MCPDESC_0_7_FORMAT_ID } from "@inspector/core/extensions/builtin/mcpdesc-0.7/constants.js";
import { readInspectorVersion } from "@inspector/core/node/version.js";

export const CLI_EXTENSION_API_VERSION = "0.1.0";

/** Static built-in metadata only; creating this catalog executes no provider. */
export const CLI_BUILTIN_CONTRIBUTION_CATALOG =
  createBuiltinContributionCatalog({
    inspectorVersion: readInspectorVersion(import.meta.url),
    extensionApiVersion: CLI_EXTENSION_API_VERSION,
  });

export function listCommandSelectors(
  catalog: StaticContributionCatalog,
): string[] {
  return catalog.commands.flatMap(({ contribution }) => [
    contribution.id,
    ...(contribution.aliases ?? []),
  ]);
}

export const CLI_COMMAND_SELECTORS = listCommandSelectors(
  CLI_BUILTIN_CONTRIBUTION_CATALOG,
);

export const CLI_ARTIFACT_SELECTORS = [
  "inspector-session",
  INSPECTOR_SESSION_FORMAT_ID,
  "mcpdesc-0.7",
  MCPDESC_0_7_FORMAT_ID,
] as const;

/** Resolve a canonical built-in command id or short selector. */
export function resolveCliCommand(
  selector: string,
): RegisteredContribution<CommandContribution> {
  const registered = resolveCommandContribution(
    CLI_BUILTIN_CONTRIBUTION_CATALOG,
    selector,
  );
  if (registered) return registered;
  throw new Error(
    `Unknown command: ${selector}. Available --command selectors: ${CLI_COMMAND_SELECTORS.join(", ")}.`,
  );
}

/** Resolve a canonical built-in artifact format id or its CLI shorthand. */
export function resolveCliArtifact(
  selector: string,
): RegisteredContribution<ArtifactFormatContribution> {
  const formatId =
    selector === "inspector-session"
      ? INSPECTOR_SESSION_FORMAT_ID
      : selector === "mcpdesc-0.7"
        ? MCPDESC_0_7_FORMAT_ID
        : selector;
  const registered = resolveArtifactContribution(
    CLI_BUILTIN_CONTRIBUTION_CATALOG,
    formatId,
  );
  if (registered) return registered;
  throw new Error(
    `Unknown artifact format: ${selector}. Available --artifact-plugin selectors: ${CLI_ARTIFACT_SELECTORS.join(", ")}.`,
  );
}
