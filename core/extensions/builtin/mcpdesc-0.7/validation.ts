import Ajv from "ajv";
import type { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type { ArtifactDiagnostic } from "../../api/artifacts.js";
import { MCPDESC_0_7_JSON_SCHEMA } from "./schema.js";

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

const validateDocument = ajv.compile(MCPDESC_0_7_JSON_SCHEMA);

function decodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function diagnosticPath(instancePath: string): Array<string | number> {
  if (instancePath === "") return [];
  return instancePath
    .slice(1)
    .split("/")
    .map(decodeJsonPointerSegment)
    .map((segment) =>
      /^(?:0|[1-9]\d*)$/.test(segment) ? Number(segment) : segment,
    );
}

function errorParameter(error: ErrorObject, name: string): string | undefined {
  const value = error.params[name];
  /* v8 ignore next -- AJV's built-in required/additionalProperties errors always provide the named property as a string. */
  return typeof value === "string" ? value : undefined;
}

function schemaErrorPath(error: ErrorObject): Array<string | number> {
  const path = diagnosticPath(error.instancePath);
  const property =
    error.keyword === "required"
      ? errorParameter(error, "missingProperty")
      : error.keyword === "additionalProperties"
        ? errorParameter(error, "additionalProperty")
        : undefined;
  return property === undefined ? path : [...path, property];
}

/** Validate an unknown value against the embedded authoritative 0.7 schema. */
export function validateMcpDescription07Document(
  document: unknown,
): ArtifactDiagnostic[] {
  if (validateDocument(document)) return [];
  // AJV sets `errors` whenever a compiled validator returns false.
  return validateDocument.errors!.map((error) => ({
    code: "artifact.schema-invalid",
    severity: "error",
    /* v8 ignore next -- AJV's built-in schema keywords always populate ErrorObject.message. */
    message: `MCP Description 0.7 schema validation failed: ${error.message ?? error.keyword}`,
    path: schemaErrorPath(error),
  }));
}
