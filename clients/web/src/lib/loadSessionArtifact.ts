import {
  DEFAULT_MAX_SESSION_ARTIFACT_BYTES,
  parseNativeSessionArtifact,
} from "@inspector/core/extensions/api/sessions.js";
import {
  createNativeSessionReplayStore,
  type NativeSessionReplayStore,
} from "@inspector/core/extensions/builtin/inspector-session/replay.js";
import type { ArtifactDiagnostic } from "@inspector/core/extensions/api/artifacts.js";

const MAX_DISPLAYED_DIAGNOSTICS = 5;

function diagnosticMessage(diagnostic: ArtifactDiagnostic): string {
  const location =
    diagnostic.path.length > 0 ? ` at ${diagnostic.path.join(".")}` : "";
  return `${diagnostic.message}${location}`;
}

function parseFailureMessage(diagnostics: ArtifactDiagnostic[]): string {
  const visible = diagnostics
    .slice(0, MAX_DISPLAYED_DIAGNOSTICS)
    .map(diagnosticMessage)
    .join("; ");
  const omitted = diagnostics.length - MAX_DISPLAYED_DIAGNOSTICS;
  return omitted > 0 ? `${visible}; ${omitted} more diagnostics` : visible;
}

/**
 * Read and validate one local native-session file, then project it into the
 * immutable replay store. This performs no network, server, OAuth, process, or
 * extension operation; the selected File is the only I/O source.
 */
export async function loadNativeSessionReplay(
  file: File,
  maxBytes = DEFAULT_MAX_SESSION_ARTIFACT_BYTES,
): Promise<NativeSessionReplayStore> {
  if (file.size > maxBytes) {
    throw new Error(`Session artifact exceeds the ${maxBytes}-byte limit`);
  }

  let content: string;
  try {
    content = await file.text();
  } catch (error) {
    throw new Error("Could not read the selected session artifact", {
      cause: error,
    });
  }

  const parsed = parseNativeSessionArtifact(content, maxBytes);
  if (!parsed.ok) {
    throw new Error(parseFailureMessage(parsed.diagnostics));
  }
  return createNativeSessionReplayStore(parsed.artifact);
}
