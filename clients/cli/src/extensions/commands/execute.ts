import type {
  CliCommandPlan,
  CliConnectedCommandPlan,
  CliNoConnectionCommandPlan,
  CliResolvedCommandPlan,
} from "./plan.js";

export interface CommandPlanHandlers {
  runWithoutConnection(plan: CliNoConnectionCommandPlan): Promise<void>;
  runWithResolvedServer(plan: CliResolvedCommandPlan): Promise<void>;
  runWithConnection(plan: CliConnectedCommandPlan): Promise<void>;
}

/** Execute a command solely from its registry-derived requirements. */
export async function executeCommandPlan(
  plan: CliCommandPlan,
  handlers: CommandPlanHandlers,
): Promise<void> {
  switch (plan.connection) {
    case "none":
      await handlers.runWithoutConnection(plan);
      return;
    case "resolved":
      await handlers.runWithResolvedServer(plan);
      return;
    case "connected":
      await handlers.runWithConnection(plan);
  }
}
