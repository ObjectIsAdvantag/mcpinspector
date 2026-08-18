import { valid, validRange } from "semver";
import { z } from "zod";
import {
  ArtifactDataAccessSchema,
  ArtifactOperationSchema,
  type ArtifactFormatContribution,
} from "../api/artifacts.js";
import {
  ConnectionRequirementSchema,
  ServerSelectionRequirementSchema,
  type CommandContribution,
} from "../api/commands.js";
import { ExtensionJsonObjectSchema } from "../api/json.js";

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const CONTRIBUTION_ID_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:[./][a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const ENCODING_PATTERN = /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;.*)?$/i;

const ExtensionIdentifierSchema = z
  .string()
  .min(1)
  .regex(
    IDENTIFIER_PATTERN,
    "Must be a lowercase namespaced identifier such as publisher.extension",
  );

const ContributionIdentifierSchema = z
  .string()
  .min(1)
  .regex(CONTRIBUTION_ID_PATTERN, "Must be a lowercase namespaced identifier");

const VersionSchema = z
  .string()
  .refine((value) => valid(value) !== null, "Must be a valid semantic version");

const VersionRangeSchema = z
  .string()
  .refine(
    (value) => validRange(value) !== null,
    "Must be a valid semantic version range",
  );

function isSafePackagePath(value: string): boolean {
  if (!value.startsWith("./") || value.includes("\\")) return false;
  const segments = value.slice(2).split("/");
  return segments.every(
    (segment) => segment !== "" && segment !== "." && segment !== "..",
  );
}

const PackageEntrypointSchema = z
  .string()
  .refine(
    isSafePackagePath,
    "Must be a relative package path beginning with ./ and containing no traversal segments",
  );

const CommandContributionSchema: z.ZodType<CommandContribution> = z
  .object({
    id: ContributionIdentifierSchema,
    aliases: z.array(ContributionIdentifierSchema).optional(),
    title: z.string().trim().min(1),
    connection: ConnectionRequirementSchema,
    serverSelection: ServerSelectionRequirementSchema,
    optionsSchema: ExtensionJsonObjectSchema.optional(),
  })
  .strict();

const ArtifactFormatContributionSchema: z.ZodType<ArtifactFormatContribution> =
  z
    .object({
      id: ContributionIdentifierSchema,
      displayName: z.string().trim().min(1),
      artifactVersion: z.string().trim().min(1),
      mediaTypes: z.array(z.string().regex(MEDIA_TYPE_PATTERN)).min(1),
      encodings: z.array(z.string().regex(ENCODING_PATTERN)).min(1),
      operations: z.array(ArtifactOperationSchema).min(1),
      optionsSchema: ExtensionJsonObjectSchema.optional(),
      dataRequirements: z
        .object({
          serverDescription: ArtifactDataAccessSchema,
          session: ArtifactDataAccessSchema,
        })
        .strict(),
    })
    .strict();

const ActivationEventSchema = z
  .string()
  .regex(
    /^(?:onCommand|onArtifactExport|onArtifactImport|onArtifactValidate|onArtifactView):.+$/,
    "Must be a supported activation event",
  );

const CapabilitiesSchema = z
  .object({
    serverData: ArtifactDataAccessSchema,
    sessionData: ArtifactDataAccessSchema,
    filesystem: z.enum(["none", "output-only", "read-write"]),
    network: z.boolean(),
    processExecution: z.boolean(),
    secrets: z.boolean(),
  })
  .strict();

const ManifestShapeSchema = z
  .object({
    id: ExtensionIdentifierSchema,
    displayName: z.string().trim().min(1),
    version: VersionSchema,
    engines: z
      .object({
        inspector: VersionRangeSchema,
        extensionApi: VersionRangeSchema,
      })
      .strict(),
    entrypoints: z
      .object({
        node: PackageEntrypointSchema.optional(),
        browser: PackageEntrypointSchema.optional(),
      })
      .strict()
      .refine(
        (entrypoints) =>
          entrypoints.node !== undefined || entrypoints.browser !== undefined,
        "At least one runtime entrypoint is required when entrypoints are declared",
      )
      .optional(),
    activationEvents: z.array(ActivationEventSchema),
    capabilities: CapabilitiesSchema,
    contributes: z
      .object({
        commands: z.array(CommandContributionSchema).optional(),
        artifactFormats: z.array(ArtifactFormatContributionSchema).optional(),
      })
      .strict(),
  })
  .strict();

export type InspectorExtensionManifest = z.infer<typeof ManifestShapeSchema>;

function activationTarget(event: string): string {
  return event.slice(event.indexOf(":") + 1);
}

function addUniqueIssue(
  values: readonly string[],
  path: Array<string | number>,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate contribution id: ${value}`,
        path: [...path, index, "id"],
      });
    }
    seen.add(value);
  });
}

export const InspectorExtensionManifestSchema = ManifestShapeSchema.superRefine(
  (manifest, ctx) => {
    const commands = manifest.contributes.commands ?? [];
    const artifactFormats = manifest.contributes.artifactFormats ?? [];
    const contributionIds = [
      ...commands.map(({ id }) => id),
      ...artifactFormats.map(({ id }) => id),
    ];

    addUniqueIssue(
      commands.map(({ id }) => id),
      ["contributes", "commands"],
      ctx,
    );
    addUniqueIssue(
      artifactFormats.map(({ id }) => id),
      ["contributes", "artifactFormats"],
      ctx,
    );

    const canonicalCommandIds = new Set(commands.map(({ id }) => id));
    const commandSelectors = new Set<string>();
    commands.forEach((command, commandIndex) => {
      commandSelectors.add(command.id);
      (command.aliases ?? []).forEach((alias, aliasIndex) => {
        if (canonicalCommandIds.has(alias) || commandSelectors.has(alias)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate command selector: ${alias}`,
            path: [
              "contributes",
              "commands",
              commandIndex,
              "aliases",
              aliasIndex,
            ],
          });
        }
        commandSelectors.add(alias);
      });
    });

    const commandIds = new Set(commands.map(({ id }) => id));
    artifactFormats.forEach(({ id }, index) => {
      if (commandIds.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate contribution id: ${id}`,
          path: ["contributes", "artifactFormats", index, "id"],
        });
      }
    });

    manifest.activationEvents.forEach((event, index) => {
      const target = activationTarget(event);
      if (!contributionIds.includes(target)) {
        ctx.addIssue({
          code: "custom",
          message: `Activation event targets undeclared contribution: ${target}`,
          path: ["activationEvents", index],
        });
      }
    });
  },
);
