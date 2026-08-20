import { parse, stringify } from "yaml";
import type { ExtensionJsonObject } from "../../api/json.js";
import type { McpDescription07Encoding } from "./constants.js";

export function encodeMcpDescription07(
  document: ExtensionJsonObject,
  encoding: McpDescription07Encoding,
): string {
  return encoding === "json"
    ? JSON.stringify(document, null, 2)
    : stringify(document, { lineWidth: 0 });
}

export function parseMcpDescription07(
  content: string,
  encoding: McpDescription07Encoding,
): unknown {
  return encoding === "json" ? JSON.parse(content) : parse(content);
}
