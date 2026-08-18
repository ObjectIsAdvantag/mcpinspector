import { describe, expect, it } from "vitest";
import { createBuiltinContributionCatalog } from "@inspector/core/extensions/builtin/catalog.js";
import { createStaticContributionCatalog } from "@inspector/core/extensions/registry/contributionRegistry.js";
import {
  INCOMPATIBLE_MANIFEST,
  INVALID_MANIFEST,
  VALID_MANIFEST,
} from "../fixtures.js";

const HOST = {
  inspectorVersion: "2.2.0",
  extensionApiVersion: "0.1.0",
} as const;

const builtin = (manifest: unknown) => ({
  manifest,
  source: "builtin" as const,
});

describe("createStaticContributionCatalog", () => {
  it("discovers static contributions without loading entrypoint code", () => {
    const catalog = createStaticContributionCatalog(
      [builtin(VALID_MANIFEST)],
      HOST,
    );
    expect(catalog.diagnostics).toEqual([]);
    expect(catalog.extensions).toEqual([
      { manifest: VALID_MANIFEST, source: "builtin" },
    ]);
    expect(catalog.commands[0]).toEqual(
      expect.objectContaining({
        extensionId: "example.mcpdesc",
        contribution: expect.objectContaining({
          id: "example.commands.inspect",
        }),
      }),
    );
    expect(catalog.artifactFormats[0]?.contribution.id).toBe(
      "example.mcpdesc-0.7",
    );
  });

  it("collects malformed and incompatible diagnostics deterministically", () => {
    const catalog = createStaticContributionCatalog(
      [builtin(INVALID_MANIFEST), builtin(INCOMPATIBLE_MANIFEST)],
      HOST,
    );
    expect(catalog.extensions).toEqual([]);
    expect(catalog.diagnostics.map(({ code }) => code)).toEqual([
      "extension.manifest-invalid",
      "extension.manifest-invalid",
      "extension.manifest-invalid",
      "extension.inspector-incompatible",
      "extension.api-incompatible",
    ]);
  });

  it("rejects duplicate extension ids", () => {
    const catalog = createStaticContributionCatalog(
      [builtin(VALID_MANIFEST), builtin(VALID_MANIFEST)],
      HOST,
    );
    expect(catalog.extensions).toHaveLength(1);
    expect(catalog.diagnostics).toEqual([
      expect.objectContaining({ code: "extension.duplicate-id" }),
    ]);
  });

  it("rejects a contribution id already owned by another extension", () => {
    const collision = structuredClone(VALID_MANIFEST);
    collision.id = "example.collision";
    collision.activationEvents = [];
    collision.contributes = {
      commands: [VALID_MANIFEST.contributes.commands![0]!],
    };
    const catalog = createStaticContributionCatalog(
      [builtin(VALID_MANIFEST), builtin(collision)],
      HOST,
    );
    expect(catalog.extensions).toHaveLength(1);
    expect(catalog.diagnostics).toEqual([
      expect.objectContaining({
        code: "extension.duplicate-contribution-id",
        contributionId: "example.commands.inspect",
      }),
    ]);
  });

  it("registers the built-in server commands and no planned artifacts", () => {
    const catalog = createBuiltinContributionCatalog(HOST);
    expect(catalog.diagnostics).toEqual([]);
    expect(catalog.commands.map(({ contribution }) => contribution.id)).toEqual(
      [
        "modelcontextprotocol.servers.list",
        "modelcontextprotocol.servers.show",
      ],
    );
    expect(catalog.artifactFormats).toEqual([]);
  });
});
