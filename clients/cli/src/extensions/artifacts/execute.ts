import type { ExtensionJsonObject } from "@inspector/core/extensions/api/json.js";
import type { ArtifactPlan } from "@inspector/core/extensions/artifacts/plan.js";
import { evaluateArtifactOperationApplicability } from "@inspector/core/extensions/artifacts/applicability.js";
import {
  ArtifactFormatHandlerRegistry,
  executeArtifactExport,
} from "@inspector/core/extensions/artifacts/service.js";
import { INSPECTOR_SESSION_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/inspector-session/artifact.js";
import { MCPDESC_0_7_ARTIFACT_PROVIDER } from "@inspector/core/extensions/builtin/mcpdesc-0.7/artifact.js";
import { CLI_BUILTIN_CONTRIBUTION_CATALOG } from "../bootstrap.js";
import { createCliArtifactOutputSink } from "./output-sink.js";

/** Fail closed before collection or handler activation when MCP is incompatible. */
export function assertCliArtifactApplicable(
  plan: ArtifactPlan,
  negotiatedProtocolVersion: string | undefined,
): void {
  const applicability = evaluateArtifactOperationApplicability(
    plan.formatId,
    {
      dataRequirements: plan.dataRequirements,
      protocol: plan.protocolRequirements,
    },
    { connected: true, negotiatedProtocolVersion },
  );
  if (applicability.status !== "applicable") {
    throw new Error(applicability.message);
  }
}

/** Activate the selected built-in handler and execute it through host-owned output. */
export async function executeCliArtifactExport(
  plan: ArtifactPlan,
  snapshot: ExtensionJsonObject,
): Promise<void> {
  const registry = new ArtifactFormatHandlerRegistry(
    CLI_BUILTIN_CONTRIBUTION_CATALOG,
  );
  registry.register(INSPECTOR_SESSION_ARTIFACT_PROVIDER);
  registry.register(MCPDESC_0_7_ARTIFACT_PROVIDER);
  const diagnostics = await executeArtifactExport(
    plan,
    snapshot,
    registry,
    createCliArtifactOutputSink(plan.output),
  );
  const notices = diagnostics.filter(({ severity }) => severity !== "error");
  if (notices.length > 0) {
    process.stderr.write(
      notices
        .map(
          ({ code, severity, message, path }) =>
            `[artifact ${severity}] ${code}: ${message} at ${JSON.stringify(path)}`,
        )
        .join("\n") + "\n",
    );
  }
  const errors = diagnostics.filter(({ severity }) => severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Artifact export failed: ${errors.map(({ message }) => message).join("; ")}`,
    );
  }
}
