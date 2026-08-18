import { describe, expect, it } from "vitest";
import { checkManifestCompatibility } from "@inspector/core/extensions/manifest/compatibility.js";
import {
  BROWSER_ONLY_MANIFEST,
  INCOMPATIBLE_MANIFEST,
  NODE_ONLY_MANIFEST,
  PLANNED_MCPDESC_08_MANIFEST,
  VALID_MANIFEST,
} from "../fixtures.js";

const HOST = {
  inspectorVersion: "2.2.0",
  extensionApiVersion: "0.1.0",
} as const;

describe("checkManifestCompatibility", () => {
  it("accepts supported engine ranges", () => {
    expect(checkManifestCompatibility(VALID_MANIFEST, HOST)).toEqual([]);
  });

  it("reports Inspector and extension API incompatibility independently", () => {
    expect(checkManifestCompatibility(INCOMPATIBLE_MANIFEST, HOST)).toEqual([
      expect.objectContaining({
        code: "extension.inspector-incompatible",
        extensionId: "example.future",
        path: ["engines", "inspector"],
      }),
      expect.objectContaining({
        code: "extension.api-incompatible",
        extensionId: "example.future",
        path: ["engines", "extensionApi"],
      }),
    ]);
  });

  it("reports a runtime-specific entrypoint mismatch", () => {
    expect(
      checkManifestCompatibility(NODE_ONLY_MANIFEST, {
        ...HOST,
        runtime: "browser",
      }),
    ).toEqual([
      expect.objectContaining({ code: "extension.runtime-unavailable" }),
    ]);
    expect(
      checkManifestCompatibility(BROWSER_ONLY_MANIFEST, {
        ...HOST,
        runtime: "node",
      }),
    ).toEqual([
      expect.objectContaining({ code: "extension.runtime-unavailable" }),
    ]);
  });

  it("keeps the planned 0.8 fixture unavailable", () => {
    expect(
      checkManifestCompatibility(PLANNED_MCPDESC_08_MANIFEST, HOST).map(
        ({ code }) => code,
      ),
    ).toEqual([
      "extension.inspector-incompatible",
      "extension.api-incompatible",
    ]);
  });
});
