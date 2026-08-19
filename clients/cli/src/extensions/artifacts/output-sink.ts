import type { ArtifactOutputDestination } from "@inspector/core/extensions/artifacts/plan.js";
import type { ArtifactOutputSink } from "@inspector/core/extensions/artifacts/service.js";
import { writeStoreFile } from "@inspector/core/storage/store-io.js";
import { awaitableLog } from "../../utils/awaitable-log.js";

export function createCliArtifactOutputSink(
  output: ArtifactOutputDestination,
): ArtifactOutputSink {
  if (output.kind === "file") {
    return {
      write: (payload) => writeStoreFile(output.path, payload.content + "\n"),
    };
  }
  return {
    write: (payload) => awaitableLog(payload.content + "\n"),
  };
}
