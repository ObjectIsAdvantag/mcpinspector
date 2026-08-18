---
name: "Implement Extension Architecture Slice"
description: "Implement a requested Inspector extension architecture phase or slice, including extension manifests, contribution registries, command and artifact plans, built-in extensions, runtime hosts, tests, and documentation."
argument-hint: "Phase or implementation slice to implement, with any constraints or acceptance criteria"
agent: agent
---

# Implement an extension architecture slice

Treat the user's arguments as the requested phase or implementation slice.

Before editing:

1. Read [AGENTS.md](../../AGENTS.md), [the repository Copilot instructions](../copilot-instructions.md), and [the extension architecture specification](../../specification/v2_extension_architecture.md).
2. Inspect the current implementation and tests around the affected seams. The specification is a candidate architecture, so reconcile it with the code that exists rather than assuming every proposed file or shape already applies.
3. Summarize the requested phase or slice, affected seams, acceptance criteria, and a small implementation plan. Then continue autonomously unless a genuinely blocking decision requires user input.

Implement only the requested phase or slice. Do not build future framework, create unused abstractions, or add empty directories for later phases. Follow the repository's test placement, coverage, documentation, security, and architectural requirements; update the specification or relevant README when the requested work changes a contract, command, dependency, file layout, or shipped behavior.

Keep all repository code and documentation in English. Never use `any`, TypeScript error suppressions, lint suppressions, or configuration changes that hide type errors.

Run the narrowest relevant tests and validation first, then run the root formatter. Run `npm run ci` only when preparing to push or when the user explicitly requests it.

In the final report, list changed files, tests and validation run, and any unresolved decisions or deliberate deferrals.
