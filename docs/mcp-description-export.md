# Export MCP Description 0.7

The Inspector can discover a connected MCP server and export an
[MCP Description](https://developer.cisco.com/mcp-description/schema/0.7.0) document. This is a
fresh description of the server, not a recording of Inspector activity.

Only MCP Description 0.7 is currently available:

| Property | Value |
| --- | --- |
| Format ID | `modelcontextprotocol.mcpdesc-0.7` |
| Artifact version | `0.7.0` |
| JSON media type | `application/vnd.modelcontextprotocol.mcp-description+json` |
| YAML media type | `application/vnd.modelcontextprotocol.mcp-description+yaml` |
| Encodings | JSON, YAML |

The `modelcontextprotocol.mcpdesc-0.8` identity is reserved but is not registered or advertised.
It will remain unavailable until an authoritative 0.8 schema exists.

## Export from the Web client

1. Connect to an MCP server.
2. Select **Export description** in the connected-server header.
3. Select **JSON** or **YAML**.

The browser downloads
`inspector-description-<server>-<timestamp>.json` or
`inspector-description-<server>-<timestamp>.yaml`. The document is collected and validated before
the browser download begins. Warnings and informational omissions appear in a notification after a
successful download; validation or collection failures produce no file.

## Export from the CLI

MCP Description is a primary artifact action. It connects and performs fresh discovery without an
unrelated `--method` invocation.

Export JSON from a catalog server to stdout:

```bash
npx @modelcontextprotocol/inspector --cli --config path/to/mcp.json --server demo \
  --artifact-plugin mcpdesc-0.7 --encoding json --output -
```

Export YAML to a file:

```bash
npx @modelcontextprotocol/inspector --cli --config path/to/mcp.json --server demo \
  --artifact-plugin modelcontextprotocol.mcpdesc-0.7 \
  --encoding yaml --output server.mcpdesc.yaml
```

`--encoding` defaults to `json`, and `--output` defaults to stdout. Artifact content is the only
value written to stdout, so JSON can be piped directly to tools such as `jq`. Successful-export
diagnostics are written to stderr. A file destination is written through the host-owned atomic
output sink.

An ad-hoc command or remote URL works in place of `--config` and `--server`; the normal
[MCP server configuration](./mcp-server-configuration.md) selection rules still apply.

## Freshness and discovery

Every export requests a new aggregate from the live server. The collector does not reuse the Web
screen's currently displayed lists or a previous artifact:

- only capabilities advertised by the server are requested;
- supported tools, resources, resource templates, and prompts lists run in parallel;
- every list bypasses the Inspector response cache;
- each `listAll*` operation follows all pagination cursors;
- tools already rejected by the Inspector as invalid are omitted and reported as diagnostics.

If any advertised list operation fails, the whole export fails. The Inspector does not write a
partial document that could be mistaken for a complete server description.

## Mapping and validation

The 0.7 mapper is version-specific. It copies source fields through a strict allowlist rather than
spreading arbitrary SDK objects into the artifact. Nested values are preserved only where the 0.7
schema explicitly permits open data, including JSON Schemas, annotations, `_meta`, and extensible
capability objects.

Before writing, the Inspector validates the projected document against the embedded authoritative
MCP Description 0.7 JSON Schema using AJV and `ajv-formats`. Structural rules, required fields,
enums, constants, additional-property rules, URI formats, and email formats are enforced for both
JSON and YAML output.

Export fails before writing when, among other cases:

- initialize metadata does not provide a non-empty server name and version;
- tools, resources, resource templates, and prompts are all empty;
- a projected value violates the 0.7 schema;
- the negotiated MCP protocol version is outside the 0.7 enum:
  `2024-11-05`, `2025-03-26`, `2025-06-18`, or `2025-11-25`;
- a remote transport URL is invalid or does not use HTTP(S).

An unsupported negotiated protocol version is not omitted or coerced to a known version. The
export fails rather than claiming compatibility the server did not negotiate.

MCP server instructions have no 0.7 destination field. When present, they are omitted and reported
as an informational diagnostic.

## Diagnostics and excluded tools

Diagnostics are separate from the MCP Description document because the external 0.7 schema has no
Inspector-diagnostics field. They can report:

- invalid tools excluded from discovery and the reason for each exclusion;
- source fields deliberately omitted because they can carry secrets;
- source fields unsupported by MCP Description 0.7;
- schema paths that failed validation.

The Web client displays successful-export warnings/notes in a notification. The CLI writes them to
stderr in the form `[artifact <severity>] <code>: <message> at <path>`, leaving stdout
machine-clean. Error diagnostics fail the command and prevent output.

## Transport disclosure and safe sharing

Artifact handlers receive a brokered, serializable snapshot rather than the live
`InspectorClient`, browser state, filesystem, or transport objects. The host discloses only the
minimum transport source needed by 0.7:

- **stdio:** the command is included; arguments, environment variables, working directory, and
  other launch settings are not represented;
- **SSE / Streamable HTTP:** the HTTP(S) URL is included after removing user information,
  query parameters, and fragments; request headers and request-init data are not represented.

Omitted stdio arguments and sanitized remote URLs produce diagnostics without recording the removed
values.

This boundary prevents common transport-secret leaks, but an MCP Description is still server
metadata—not a universally redacted record. Server-published descriptions, schemas, annotations,
capabilities, and `_meta` values can contain sensitive or proprietary content, and a stdio command
or URL path may itself be sensitive. Inspect the resulting file before sharing it. For a redacted
record of Inspector activity and disconnected replay, use a
[native Inspector session](./native-session-record-replay.md) instead.
