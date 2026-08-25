export const MCPDESC_0_8_DRAFT_1_EXTENSION_ID =
  "modelcontextprotocol.mcpdesc-0.8.0-draft.1";
export const MCPDESC_0_8_DRAFT_1_FORMAT_ID =
  "modelcontextprotocol.mcpdesc-0.8.0-draft.1";
export const MCPDESC_0_8_DRAFT_1_ARTIFACT_VERSION = "0.8.0-draft.1";
export const MCPDESC_0_8_DRAFT_1_DOCUMENT_VERSION = "0.8.0";
export const MCPDESC_0_8_DRAFT_1_SCHEMA_URI =
  "https://mcpdesc.org/schema/0.8.0.json";
export const MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE =
  "application/vnd.modelcontextprotocol.mcp-description+json";
export const MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE =
  "application/vnd.modelcontextprotocol.mcp-description+yaml";

export const MCPDESC_0_8_DRAFT_1_ENCODINGS = ["json", "yaml"] as const;
export type McpDescription08Draft1Encoding =
  (typeof MCPDESC_0_8_DRAFT_1_ENCODINGS)[number];

export function isMcpDescription08Draft1Encoding(
  value: string,
): value is McpDescription08Draft1Encoding {
  return MCPDESC_0_8_DRAFT_1_ENCODINGS.some((encoding) => encoding === value);
}

export function mcpDescription08Draft1MediaType(
  encoding: McpDescription08Draft1Encoding,
): string {
  return encoding === "json"
    ? MCPDESC_0_8_DRAFT_1_JSON_MEDIA_TYPE
    : MCPDESC_0_8_DRAFT_1_YAML_MEDIA_TYPE;
}
