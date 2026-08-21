import type { ArtifactOperationRequirements } from "../api/artifacts.js";

export interface ArtifactApplicabilityContext {
  connected: boolean;
  negotiatedProtocolVersion?: string;
}

export type ArtifactOperationApplicability =
  | { status: "applicable" }
  | {
      status: "indeterminate";
      code: "artifact.protocol-version-indeterminate";
      message: string;
      supportedVersions: readonly string[];
    }
  | {
      status: "incompatible";
      code: "artifact.protocol-version-incompatible";
      message: string;
      negotiatedVersion?: string;
      supportedVersions: readonly string[];
    };

/** Evaluate live protocol applicability without activating an extension. */
export function evaluateArtifactOperationApplicability(
  formatDisplayName: string,
  requirements: ArtifactOperationRequirements,
  context: ArtifactApplicabilityContext,
): ArtifactOperationApplicability {
  const supportedVersions = requirements.protocol?.negotiatedVersions;
  if (supportedVersions === undefined) return { status: "applicable" };

  if (!context.connected) {
    return {
      status: "indeterminate",
      code: "artifact.protocol-version-indeterminate",
      message: `${formatDisplayName} requires a live connection before negotiated MCP protocol compatibility can be determined.`,
      supportedVersions,
    };
  }

  const negotiatedVersion = context.negotiatedProtocolVersion;
  if (
    negotiatedVersion !== undefined &&
    supportedVersions.includes(negotiatedVersion)
  ) {
    return { status: "applicable" };
  }

  return {
    status: "incompatible",
    code: "artifact.protocol-version-incompatible",
    message:
      negotiatedVersion === undefined
        ? `${formatDisplayName} cannot run because the connected server has no negotiated MCP protocol version. Supported versions: ${supportedVersions.join(", ")}.`
        : `${formatDisplayName} does not support negotiated MCP protocol version ${negotiatedVersion}. Supported versions: ${supportedVersions.join(", ")}.`,
    negotiatedVersion,
    supportedVersions,
  };
}
