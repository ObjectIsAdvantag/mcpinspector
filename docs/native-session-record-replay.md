# Record and replay native Inspector sessions

Native Inspector sessions are portable, read-only JSON records of an MCP inspection. They let you
capture what the Inspector observed, share the redacted record, and review it later without the MCP
server running.

The initial format is Inspector-owned and versioned independently from MCP:

| Property | Value |
| --- | --- |
| Format ID | `modelcontextprotocol.inspector-session-1` |
| Artifact version | `1.0.0` |
| Media type | `application/vnd.modelcontextprotocol.inspector-session+json` |
| Encoding | JSON |
| Default open limit | 50 MiB |

## Record from the Web client

1. Connect to an MCP server.
2. Exercise the server capabilities you want to capture.
3. Select **Export session** in the connected-server header.

The browser downloads `inspector-session-<server>-<timestamp>.json`. Repeated exports from one live
connection use the same session ID, but each export records a fresh capture time. The artifact is a
snapshot at export time; recording does not continue after the download.

## Record one CLI invocation

Add the native artifact format and an output destination to any supported connected CLI invocation:

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list \
  --artifact-plugin inspector-session --output session.json
```

A file destination is written atomically with owner-only permissions. The ordinary method result
stays on stdout. Use `--output -`, or omit `--output`, to emit only the artifact document to stdout.

A CLI artifact covers that invocation and its connection activity. A Web artifact can include the
accumulated live-session state visible when export is selected.

## Open a session in the Web client

1. Disconnect any live server. **Open Session** is disabled unless the client is fully
  disconnected.
2. Go to **Servers** and select **Open Session**.
3. Choose the native session JSON file.
4. Use the left navigation to inspect every non-empty recorded section. Select an entry to expand
   its captured JSON. Long sections are paginated.
5. Select **Close session replay** to return to the server list.

Replay is a dedicated full-screen, read-only mode. It does not need the recorded MCP server and does
not change the server catalog.

## Artifact schema reference

Every version 1 artifact has this top-level structure:

```json
{
  "header": {
    "format": {
      "id": "modelcontextprotocol.inspector-session-1",
      "version": "1.0.0"
    },
    "inspectorVersion": "2.2.0",
    "capturedAt": "2026-08-19T10:15:00.000Z",
    "sessionId": "session-1"
  },
  "server": {
    "source": {},
    "implementation": {},
    "protocolVersion": "2025-06-18",
    "protocolEra": "modern",
    "capabilities": {},
    "instructions": ""
  },
  "discovery": {
    "tools": [],
    "resources": [],
    "resourceTemplates": [],
    "prompts": [],
    "diagnostics": []
  },
  "events": {
    "protocol": [],
    "network": [],
    "stderr": [],
    "console": [],
    "tasks": [],
    "subscriptions": [],
    "auth": []
  },
  "attachments": [],
  "diagnostics": []
}
```

### Header

- `format.id` and `format.version` identify the document before replay.
- `inspectorVersion` identifies the writer.
- `capturedAt` is an offset-aware ISO 8601 timestamp.
- `sessionId` groups snapshots from the same live connection.

### Server

`server` records passive source metadata, the server implementation identity, negotiated protocol
version and era, capabilities, and instructions when available. Optional fields may be absent.
Recorded source data is display-only during replay.

### Discovery

`discovery` contains the captured tools, resources, resource templates, and prompts. Its diagnostics
record partial or failed discovery separately from artifact-level diagnostics.

### Events

`events` groups captured protocol messages, network requests, server stderr, MCP log messages,
tasks, resource subscriptions, and authentication events. Surfaces can leave sections empty when
they do not observe that event class.

### Attachments and diagnostics

An attachment contains `id`, `mediaType`, `byteLength`, and `reference` metadata. Replay displays the
record but never follows the reference. Artifact diagnostics describe redaction, validation, or
capture conditions with a stable `code`, `severity`, `message`, and JSON `path`.

Objects are extensible for compatible additions. A reader preserves and displays unknown fields
from the same artifact version. A different format ID or unsupported artifact version is rejected
rather than guessed or migrated implicitly.

## Redaction and safe sharing

The shared snapshot builder recursively redacts known sensitive keys and values before
serialization, including authorization and cookie headers, passwords, secrets, tokens, environment
values, sensitive URL query parameters, and encoded request or response bodies. Redactions appear
as `[REDACTED]` and produce diagnostics.

Redaction reduces accidental disclosure; it is not a substitute for reviewing an artifact before
sharing it. Tool arguments, resource content, log messages, server instructions, and application
metadata can contain business-sensitive data even when they contain no credential-shaped key.

## Replay security boundary

Opening an artifact parses untrusted JSON under a size limit and builds an immutable document view.
It never:

- creates an `InspectorClient` or reconnects to the recorded server;
- executes a recorded stdio command or reads recorded environment variables;
- fetches a recorded URL or attachment reference;
- starts or refreshes OAuth;
- activates an extension from artifact content; or
- adds, edits, or removes catalog entries.

The browser checks the file's declared size before reading it, and the shared parser independently
checks the encoded JSON size. Malformed, oversized, wrong-format, and unsupported-version files fail
closed with an error notification.
