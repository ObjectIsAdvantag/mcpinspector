export type ExtensionDiagnosticCode =
  | "extension.manifest-invalid"
  | "extension.inspector-incompatible"
  | "extension.api-incompatible"
  | "extension.runtime-unavailable"
  | "extension.duplicate-id"
  | "extension.duplicate-contribution-id";

export interface ExtensionDiagnostic {
  code: ExtensionDiagnosticCode;
  message: string;
  path: Array<string | number>;
  extensionId?: string;
  contributionId?: string;
}
