import type { ExtensionHostCompatibility } from "../manifest/compatibility.js";
import {
  createStaticContributionCatalog,
  type StaticContributionCatalog,
} from "../registry/contributionRegistry.js";
import { BUILTIN_EXTENSION_MANIFESTS } from "./manifests.js";

export function createBuiltinContributionCatalog(
  host: ExtensionHostCompatibility,
): StaticContributionCatalog {
  return createStaticContributionCatalog(BUILTIN_EXTENSION_MANIFESTS, host);
}
