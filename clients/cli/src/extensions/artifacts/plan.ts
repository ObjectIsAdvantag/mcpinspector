import type { ArtifactPlan } from "@inspector/core/extensions/artifacts/plan.js";
import type { ArtifactFormatContribution } from "@inspector/core/extensions/api/artifacts.js";
import type { RegisteredContribution } from "@inspector/core/extensions/registry/contributionRegistry.js";
import type { CliConnectedCommandPlan } from "../commands/plan.js";
import { resolveCliArtifact } from "../bootstrap.js";

export interface CliArtifactCommandPlan {
  kind: "artifact-command";
  command: CliConnectedCommandPlan;
  artifact: ArtifactPlan;
}

/** Build an export plan from static contribution metadata without activation. */
export function buildCliArtifactPlan(
  selector: string,
  encoding: string | undefined,
  outputPath: string | undefined,
): ArtifactPlan {
  const registered = resolveCliArtifact(selector);
  return buildCliArtifactPlanFromContribution(
    selector,
    registered,
    encoding,
    outputPath,
  );
}

export function buildCliArtifactPlanFromContribution(
  selector: string,
  registered: RegisteredContribution<ArtifactFormatContribution>,
  encoding: string | undefined,
  outputPath: string | undefined,
): ArtifactPlan {
  const contribution = registered.contribution;
  const selectedEncoding = encoding ?? contribution.encodings[0];
  if (
    selectedEncoding === undefined ||
    !contribution.encodings.includes(selectedEncoding)
  ) {
    throw new Error(
      `Artifact format ${selector} does not support encoding ${selectedEncoding ?? "(none)"}. Supported encodings: ${contribution.encodings.join(", ")}.`,
    );
  }
  if (!contribution.operations.includes("export")) {
    throw new Error(`Artifact format ${selector} does not support export.`);
  }
  const mediaType = contribution.mediaTypes[0];
  if (mediaType === undefined) {
    throw new Error(`Artifact format ${selector} declares no media type.`);
  }

  return {
    kind: "artifact",
    formatId: contribution.id,
    extensionId: registered.extensionId,
    artifactVersion: contribution.artifactVersion,
    operation: "export",
    encoding: selectedEncoding,
    mediaType,
    options: {},
    output:
      outputPath === undefined || outputPath === "-"
        ? { kind: "stdout" }
        : { kind: "file", path: outputPath },
  };
}
