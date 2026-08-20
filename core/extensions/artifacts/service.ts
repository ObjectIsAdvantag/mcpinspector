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

export interface ArtifactFormatHandler {
  formatId: string;
  export(
    data: ExtensionJsonObject,
    options: ExtensionJsonObject,
    encoding?: string,
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

export class ArtifactFormatHandlerRegistry {
  private readonly handlers = new Map<string, ArtifactFormatHandler>();
  private readonly catalog: StaticContributionCatalog;

  constructor(catalog: StaticContributionCatalog) {
    this.catalog = catalog;
  }

  register(handler: ArtifactFormatHandler): void {
    const registration = resolveArtifactContribution(
      this.catalog,
      handler.formatId,
    );
    if (registration === undefined) {
      throw new Error(
        `Artifact format handler has no contribution: ${handler.formatId}`,
      );
    }
    if (this.handlers.has(handler.formatId)) {
      throw new Error(
        `Artifact format handler already registered: ${handler.formatId}`,
      );
    }
    this.handlers.set(handler.formatId, handler);
  }

  resolve(formatId: string): ArtifactFormatHandler | undefined {
    return this.handlers.get(formatId);
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

/** Execute an export without giving the format handler filesystem/stdout access. */
export async function executeArtifactExport(
  plan: ArtifactPlan,
  data: ExtensionJsonObject,
  registry: ArtifactFormatHandlerRegistry,
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
  const handler = registry.resolve(plan.formatId);
  if (handler === undefined) {
    return [
      errorDiagnostic(
        "artifact.handler-missing",
        `No handler is registered for artifact format: ${plan.formatId}`,
      ),
    ];
  }

  const result = await handler.export(data, plan.options, plan.encoding);
  if (result.payload === undefined) return result.diagnostics;
  if (!payloadMatchesPlan(plan, result.payload)) {
    return [
      ...result.diagnostics,
      errorDiagnostic(
        "artifact.payload-mismatch",
        "Artifact format handler returned content that does not match the selected plan",
      ),
    ];
  }

  const validationDiagnostics = await handler.validate(result.payload);
  const diagnostics = [...result.diagnostics, ...validationDiagnostics];
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return diagnostics;
  }
  await sink.write(result.payload);
  return diagnostics;
}
