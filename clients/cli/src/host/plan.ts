export type CliHostPlan =
  | {
      kind: "host";
      operation: "list-stored-auth";
      oauthStatePath: string;
    }
  | {
      kind: "host";
      operation: "print-handoff";
      oauthStatePath: string;
      serverUrl: string;
      transport?: "sse" | "http" | "stdio";
    };
