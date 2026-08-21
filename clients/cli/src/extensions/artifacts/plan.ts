import type { ArtifactPlan } from "@inspector/core/extensions/artifacts/plan.js";
import {
  resolveArtifactMediaType,
  type ArtifactFormatContribution,
} from "@inspector/core/extensions/api/artifacts.js";
import type { RegisteredContribution } from "@inspector/core/extensions/registry/contributionRegistry.js";
import type { CliConnectedCommandPlan } from "../commands/plan.js";
import { resolveCliArtifact } from "../bootstrap.js";

export interface CliArtifactCommandPlan {
  kind: "artifact-command";
  command: CliConnectedCommandPlan | CliArtifactConnectionPlan;
  artifact: ArtifactPlan;
}

export interface CliArtifactConnectionPlan extends Omit<
  CliConnectedCommandPlan,
  "methodArgs"
> {
  methodArgs?: undefined;
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
  const exportRequirements = contribution.operationRequirements.export;
  if (exportRequirements === undefined) {
    throw new Error(`Artifact format ${selector} does not support export.`);
  }
  const mediaType = resolveArtifactMediaType(contribution, selectedEncoding);
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
    dataRequirements: exportRequirements.dataRequirements,
    protocolRequirements: exportRequirements.protocol,
    options: {},
    output:
      outputPath === undefined || outputPath === "-"
        ? { kind: "stdout" }
        : { kind: "file", path: outputPath },
  };
}
