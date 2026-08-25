import { parse, stringify } from "yaml";
import type { ExtensionJsonObject } from "../../api/json.js";
import type { McpDescription08Draft1Encoding } from "./constants.js";

export function encodeMcpDescription08Draft1(
  document: ExtensionJsonObject,
  encoding: McpDescription08Draft1Encoding,
): string {
  return encoding === "json"
    ? JSON.stringify(document, null, 2)
    : stringify(document, { lineWidth: 0 });
}

export function parseMcpDescription08Draft1(
  content: string,
  encoding: McpDescription08Draft1Encoding,
): unknown {
  return encoding === "json" ? JSON.parse(content) : parse(content);
}
