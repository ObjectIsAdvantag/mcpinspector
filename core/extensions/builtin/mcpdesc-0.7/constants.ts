export const MCPDESC_0_7_EXTENSION_ID = "modelcontextprotocol.mcpdesc";
export const MCPDESC_0_7_FORMAT_ID = "modelcontextprotocol.mcpdesc-0.7";
export const MCPDESC_0_7_ARTIFACT_VERSION = "0.7.0";
export const MCPDESC_0_7_SCHEMA_URI =
  "https://developer.cisco.com/mcp-description/schema/0.7.0";
export const MCPDESC_0_7_JSON_MEDIA_TYPE =
  "application/vnd.modelcontextprotocol.mcp-description+json";
export const MCPDESC_0_7_YAML_MEDIA_TYPE =
  "application/vnd.modelcontextprotocol.mcp-description+yaml";

export const MCPDESC_0_7_ENCODINGS = ["json", "yaml"] as const;
export type McpDescription07Encoding = (typeof MCPDESC_0_7_ENCODINGS)[number];

export function isMcpDescription07Encoding(
  value: string | undefined,
): value is McpDescription07Encoding {
  return value === "json" || value === "yaml";
}

export function mcpDescription07MediaType(
  encoding: McpDescription07Encoding,
): string {
  return encoding === "json"
    ? MCPDESC_0_7_JSON_MEDIA_TYPE
    : MCPDESC_0_7_YAML_MEDIA_TYPE;
}
