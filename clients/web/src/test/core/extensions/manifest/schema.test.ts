import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@inspector/core/extensions/manifest/parse.js";
import { InspectorExtensionManifestSchema } from "@inspector/core/extensions/manifest/schema.js";
import { INVALID_MANIFEST, VALID_MANIFEST } from "../fixtures.js";

describe("InspectorExtensionManifestSchema", () => {
  it("accepts a complete static manifest", () => {
    expect(InspectorExtensionManifestSchema.parse(VALID_MANIFEST)).toEqual(
      VALID_MANIFEST,
    );
  });

  it("accepts a built-in manifest without runtime entrypoints", () => {
    const manifest = {
      ...VALID_MANIFEST,
      entrypoints: undefined,
    };
    expect(InspectorExtensionManifestSchema.parse(manifest).entrypoints).toBe(
      undefined,
    );
  });

  it.each([
    [{}, "At least one runtime entrypoint"],
    [{ node: "extension.js" }, "relative package path"],
    [{ node: "./dist/../escape.js" }, "relative package path"],
    [{ node: ".\\extension.js" }, "relative package path"],
  ])("rejects unsafe entrypoints %#", (entrypoints, message) => {
    const result = InspectorExtensionManifestSchema.safeParse({
      ...VALID_MANIFEST,
      entrypoints,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes(message)),
      ).toBe(true);
    }
  });

  it("rejects malformed identifiers, versions, and paths together", () => {
    const result = parseExtensionManifest(INVALID_MANIFEST);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map(({ path }) => path)).toEqual(
        expect.arrayContaining([["id"], ["version"], ["entrypoints", "node"]]),
      );
    }
  });

  it("rejects non-JSON option schemas", () => {
    const manifest = {
      ...VALID_MANIFEST,
      contributes: {
        ...VALID_MANIFEST.contributes,
        commands: [
          {
            ...VALID_MANIFEST.contributes.commands![0]!,
            optionsSchema: { invalid: undefined },
          },
        ],
      },
    };
    expect(InspectorExtensionManifestSchema.safeParse(manifest).success).toBe(
      false,
    );
  });

  it("rejects duplicate contribution ids", () => {
    const manifest = structuredClone(VALID_MANIFEST);
    manifest.contributes.commands!.push({
      ...manifest.contributes.commands![0]!,
    });
    const result = InspectorExtensionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Duplicate contribution id: example.commands.inspect",
          path: ["contributes", "commands", 1, "id"],
        }),
      );
    }
  });

  it("reports numeric indexes in parsed diagnostic paths", () => {
    const manifest = structuredClone(VALID_MANIFEST);
    manifest.contributes.commands!.push({
      ...manifest.contributes.commands![0]!,
    });
    const result = parseExtensionManifest(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          path: ["contributes", "commands", 1, "id"],
        }),
      );
    }
  });

  it("rejects contribution ids duplicated across families", () => {
    const manifest = structuredClone(VALID_MANIFEST);
    manifest.contributes.artifactFormats![0]!.id =
      manifest.contributes.commands![0]!.id;
    manifest.activationEvents = [];
    const result = InspectorExtensionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Duplicate contribution id: example.commands.inspect",
          path: ["contributes", "artifactFormats", 0, "id"],
        }),
      );
    }
  });

  it("rejects activation events for undeclared contributions", () => {
    const result = InspectorExtensionManifestSchema.safeParse({
      ...VALID_MANIFEST,
      activationEvents: ["onArtifactView:example.missing"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "targets undeclared contribution",
      );
    }
  });

  it("rejects unsupported activation events", () => {
    expect(
      InspectorExtensionManifestSchema.safeParse({
        ...VALID_MANIFEST,
        activationEvents: ["onStartup"],
      }).success,
    ).toBe(false);
  });
});
