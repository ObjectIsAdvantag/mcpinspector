import type { ExtensionJsonObject } from "@inspector/core/extensions/api/json.js";
import type { ArtifactPlan } from "@inspector/core/extensions/artifacts/plan.js";
import {
  ArtifactProviderRegistry,
  executeArtifactExport,
} from "@inspector/core/extensions/artifacts/service.js";
import { INSPECTOR_SESSION_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/provider.js";
import { CLI_BUILTIN_CONTRIBUTION_CATALOG } from "../bootstrap.js";
import { createCliArtifactOutputSink } from "./output-sink.js";

/** Activate the selected built-in provider and execute it through a host sink. */
export async function executeCliArtifactExport(
  plan: ArtifactPlan,
  snapshot: ExtensionJsonObject,
): Promise<void> {
  const registry = new ArtifactProviderRegistry(
    CLI_BUILTIN_CONTRIBUTION_CATALOG,
  );
  registry.register(INSPECTOR_SESSION_PROVIDER);
  const diagnostics = await executeArtifactExport(
    plan,
    snapshot,
    registry,
    createCliArtifactOutputSink(plan.output),
  );
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Artifact export failed: ${errors.map(({ message }) => message).join("; ")}`,
    );
  }
}
