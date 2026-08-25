# Export MCP Description

The Inspector can discover a connected MCP server and export an
[MCP Description](https://mcpdesc.org/) document. This is a fresh description of the server, not a
recording of Inspector activity. Stable 0.7 and the immutable 0.8.0 Draft 1 interoperability
snapshot are separate artifact formats:

| Format | Format ID | Artifact version | Supported negotiated MCP revisions |
| --- | --- | --- | --- |
| MCP Description 0.7 (stable) | `modelcontextprotocol.mcpdesc-0.7` | `0.7.0` | `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25` |
| MCP Description 0.8.0 Draft 1 | `modelcontextprotocol.mcpdesc-0.8.0-draft.1` | `0.8.0-draft.1` | The four revisions above plus `2026-07-28` |

Both support JSON and YAML with media types
`application/vnd.modelcontextprotocol.mcp-description+json` and
`application/vnd.modelcontextprotocol.mcp-description+yaml`. The stable 0.8 identity
`modelcontextprotocol.mcpdesc-0.8` remains reserved.

## Export from the Web client

1. Connect to an MCP server.
2. Select **Export description** in the connected-server header.
3. Under the required format, select **JSON** or **YAML**.

Both formats remain visible. A format is disabled with an explanation when it does not support the
negotiated revision. On `2026-07-28`, stable 0.7 is disabled and Draft 1 remains available.

The browser downloads
`inspector-description-0.7-<server>-<timestamp>.<encoding>` or
`inspector-description-0.8.0-draft.1-<server>-<timestamp>.<encoding>`. The document is collected and validated before
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

Export Draft 1 for a server negotiated on any supported revision:

```bash
npx @modelcontextprotocol/inspector --cli --config path/to/mcp.json --server demo \
  --artifact-plugin mcpdesc-0.8-draft.1 --encoding yaml --output server.mcpdesc.yaml
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

Each mapper is version-specific. It copies source fields through a strict allowlist rather than
spreading arbitrary SDK objects into the artifact. Nested values are preserved only where the 0.7
schema explicitly permits open data, including JSON Schemas, annotations, `_meta`, and extensible
capability objects.

Stable 0.7 is validated against its embedded authoritative schema. Draft 1 is validated through
`@mcpdesc/validator` `0.1.0`, which binds the schema and semantic rules for snapshot
`0.8.0-draft.1` and returns structured diagnostics without network access. Both JSON and YAML
outputs receive the same validation.

Every export describes only the current negotiated connection. Draft 1 therefore emits exactly
one root revision, for example `"protocolVersions": ["2025-11-25"]`; it does not reconnect under
other revisions or merge multiple protocol views.

Export fails before writing when, among other cases:

- initialize metadata does not provide a non-empty server name and version;
- for 0.7, tools, resources, resource templates, and prompts are all empty;
- a projected value violates the 0.7 schema;
- the negotiated MCP protocol version is outside the 0.7 enum:
  the revisions declared for the selected format in the table above;
- a remote transport URL is invalid or does not use HTTP(S).

An unsupported negotiated protocol version is not omitted or coerced to a known version. The
host rejects export before fresh discovery or artifact-handler activation rather than claiming
compatibility the server did not negotiate. The embedded schema repeats the check as defense in
depth. Compatibility uses the version actually negotiated by this Inspector connection—not the
newest version the server could support. A dual-era server negotiated as legacy `2025-11-25` is
therefore exportable, while the same server negotiated as modern `2026-07-28` is not.

MCP server instructions have no 0.7 destination field. They are omitted with an informational
diagnostic in 0.7 and preserved at the Draft 1 document root.

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
