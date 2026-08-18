import { createBuiltinContributionCatalog } from "@inspector/core/extensions/builtin/catalog.js";
import {
  resolveCommandContribution,
  type RegisteredContribution,
  type StaticContributionCatalog,
} from "@inspector/core/extensions/registry/contributionRegistry.js";
import type { CommandContribution } from "@inspector/core/extensions/api/commands.js";
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
