import type {
  CommandPlan,
  OutputOptions,
} from "@inspector/core/extensions/commands/plan.js";
import type { RegisteredContribution } from "@inspector/core/extensions/registry/contributionRegistry.js";
import type { CommandContribution } from "@inspector/core/extensions/api/commands.js";
import type { ServerLoadOptions } from "@inspector/core/mcp/node/index.js";
import { hasAdHocServerOptions } from "@inspector/core/mcp/node/index.js";
import type { MethodArgs, OutputFormat } from "../../handlers/method-types.js";

export type CliServerLoadOptions = Omit<ServerLoadOptions, "secretStore">;

interface CliCommandPlanBase extends CommandPlan {
  serverOptions: CliServerLoadOptions;
  format: OutputFormat;
}

export interface CliNoConnectionCommandPlan extends CliCommandPlanBase {
  connection: "none";
  serverSelection: "all";
}

export interface CliResolvedCommandPlan extends CliCommandPlanBase {
  connection: "resolved";
  serverSelection: "exactly-one";
  serverName: string;
}

export interface CliConnectedCommandPlan extends CliCommandPlanBase {
  connection: "connected";
  serverSelection: "exactly-one";
  serverName?: string;
  methodArgs: MethodArgs & { method: string };
  adHoc: boolean;
  connectTimeout?: number;
  oauthStatePath: string;
  waitForAuth?: number;
  useStoredAuth: boolean;
  clientConfigPath?: string;
  clientId?: string;
  clientSecret?: string;
  clientMetadataUrl?: string;
  callbackUrl?: string;
  storedAuthOnly: boolean;
  relogin: boolean;
}

export type CliCommandPlan =
  | CliNoConnectionCommandPlan
  | CliResolvedCommandPlan
  | CliConnectedCommandPlan;

/** Describe the selected source without loading or resolving any server. */
export function describeServerSource(
  options: CliServerLoadOptions,
): CommandPlan["serverSource"] {
  if (options.catalogPath?.trim()) {
    return { kind: "catalog", path: options.catalogPath };
  }
  if (options.configPath?.trim()) {
    return { kind: "config", path: options.configPath };
  }
  if (hasAdHocServerOptions(options)) {
    return { kind: "ad-hoc", target: options.target ?? [] };
  }
  return { kind: "default-catalog" };
}

export function describeOutput(format: OutputFormat): OutputOptions {
  return {
    destination: { kind: "stdout" },
    encoding: format,
  };
}

/** Copy validated registry metadata into a canonical command-plan DTO. */
export function buildCommandPlan(
  registered: RegisteredContribution<CommandContribution>,
  serverOptions: CliServerLoadOptions,
  format: OutputFormat,
): CommandPlan {
  return {
    kind: "command",
    commandId: registered.contribution.id,
    extensionId: registered.extensionId,
    serverSource: describeServerSource(serverOptions),
    serverSelection: registered.contribution.serverSelection,
    connection: registered.contribution.connection,
    options: {},
    output: describeOutput(format),
  };
}
