import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@inspector/core/extensions/manifest/parse.js";
import { InspectorExtensionManifestSchema } from "@inspector/core/extensions/manifest/schema.js";
import { resolveArtifactMediaType } from "@inspector/core/extensions/api/artifacts.js";
import { INVALID_MANIFEST, VALID_MANIFEST } from "../fixtures.js";

describe("InspectorExtensionManifestSchema", () => {
  it("accepts a complete static manifest", () => {
    expect(InspectorExtensionManifestSchema.parse(VALID_MANIFEST)).toEqual(
      VALID_MANIFEST,
    );
  });

  it("resolves media types by the validated encoding order", () => {
    const contribution = VALID_MANIFEST.contributes.artifactFormats![0]!;
    expect(resolveArtifactMediaType(contribution, "json")).toBe(
      "application/json",
    );
    expect(resolveArtifactMediaType(contribution, "yaml")).toBe(
      "application/yaml",
    );
    expect(resolveArtifactMediaType(contribution, "toml")).toBeUndefined();
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

  it("requires a unique encoding and one same-index media type per encoding", () => {
    const mismatched = structuredClone(VALID_MANIFEST);
    mismatched.contributes.artifactFormats![0]!.mediaTypes = [
      "application/json",
    ];
    const mismatchedResult =
      InspectorExtensionManifestSchema.safeParse(mismatched);
    expect(mismatchedResult.success).toBe(false);
    if (!mismatchedResult.success) {
      expect(mismatchedResult.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Each artifact encoding must have one media type",
          path: ["contributes", "artifactFormats", 0, "mediaTypes"],
        }),
      );
    }

    const duplicate = structuredClone(VALID_MANIFEST);
    duplicate.contributes.artifactFormats![0]!.encodings = ["json", "json"];
    expect(InspectorExtensionManifestSchema.safeParse(duplicate).success).toBe(
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

  it("rejects duplicate command selectors", () => {
    const manifest = structuredClone(VALID_MANIFEST);
    manifest.contributes.commands!.push({
      id: "example.commands.other",
      aliases: ["commands/inspect"],
      title: "Other command",
      connection: "none",
      serverSelection: "none",
    });
    const result = InspectorExtensionManifestSchema.safeParse(manifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Duplicate command selector: commands/inspect",
          path: ["contributes", "commands", 1, "aliases", 0],
        }),
      );
    }
  });

  it("rejects an alias that duplicates a canonical command id", () => {
    const manifest = structuredClone(VALID_MANIFEST);
    manifest.contributes.commands![0]!.aliases = ["example.commands.inspect"];
    expect(InspectorExtensionManifestSchema.safeParse(manifest).success).toBe(
      false,
    );
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
