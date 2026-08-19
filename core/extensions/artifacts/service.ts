import type {
  ArtifactDiagnostic,
  ArtifactExportResult,
  ArtifactPayload,
} from "../api/artifacts.js";
import type { ExtensionJsonObject } from "../api/json.js";
import type { ArtifactPlan } from "./plan.js";
import {
  resolveArtifactContribution,
  type StaticContributionCatalog,
} from "../registry/contributionRegistry.js";

export interface ArtifactProvider {
  formatId: string;
  export(
    data: ExtensionJsonObject,
    options: ExtensionJsonObject,
  ): Promise<ArtifactExportResult> | ArtifactExportResult;
  validate(
    payload: ArtifactPayload,
  ): Promise<ArtifactDiagnostic[]> | ArtifactDiagnostic[];
}

export interface ArtifactOutputSink {
  write(payload: ArtifactPayload): Promise<void> | void;
}

function errorDiagnostic(code: string, message: string): ArtifactDiagnostic {
  return { code, severity: "error", message, path: [] };
}

export class ArtifactProviderRegistry {
  private readonly providers = new Map<string, ArtifactProvider>();
  private readonly catalog: StaticContributionCatalog;

  constructor(catalog: StaticContributionCatalog) {
    this.catalog = catalog;
  }

  register(provider: ArtifactProvider): void {
    const registration = resolveArtifactContribution(
      this.catalog,
      provider.formatId,
    );
    if (registration === undefined) {
      throw new Error(
        `Artifact provider has no contribution: ${provider.formatId}`,
      );
    }
    if (this.providers.has(provider.formatId)) {
      throw new Error(
        `Artifact provider already registered: ${provider.formatId}`,
      );
    }
    this.providers.set(provider.formatId, provider);
  }

  resolve(formatId: string): ArtifactProvider | undefined {
    return this.providers.get(formatId);
  }
}

function payloadMatchesPlan(
  plan: ArtifactPlan,
  payload: ArtifactPayload,
): boolean {
  return (
    payload.formatId === plan.formatId &&
    payload.artifactVersion === plan.artifactVersion &&
    payload.encoding === plan.encoding &&
    payload.mediaType === plan.mediaType
  );
}

/** Execute an export without giving the provider direct filesystem/stdout access. */
export async function executeArtifactExport(
  plan: ArtifactPlan,
  data: ExtensionJsonObject,
  registry: ArtifactProviderRegistry,
  sink: ArtifactOutputSink,
): Promise<ArtifactDiagnostic[]> {
  if (plan.operation !== "export") {
    return [
      errorDiagnostic(
        "artifact.operation-unsupported",
        `Artifact export executor cannot run operation: ${plan.operation}`,
      ),
    ];
  }
  const provider = registry.resolve(plan.formatId);
  if (provider === undefined) {
    return [
      errorDiagnostic(
        "artifact.provider-missing",
        `No provider is registered for artifact format: ${plan.formatId}`,
      ),
    ];
  }

  const result = await provider.export(data, plan.options);
  if (result.payload === undefined) return result.diagnostics;
  if (!payloadMatchesPlan(plan, result.payload)) {
    return [
      ...result.diagnostics,
      errorDiagnostic(
        "artifact.payload-mismatch",
        "Artifact provider returned content that does not match the selected plan",
      ),
    ];
  }

  const validationDiagnostics = await provider.validate(result.payload);
  const diagnostics = [...result.diagnostics, ...validationDiagnostics];
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return diagnostics;
  }
  await sink.write(result.payload);
  return diagnostics;
}
