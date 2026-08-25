# Keeping the extension fork synchronized

This fork develops the Inspector host extension architecture while tracking the reference implementation at `modelcontextprotocol/inspector`. The extension architecture remains experimental until the reference maintainers accept it.

## Remotes and branch roles

| Ref | Role | History policy |
| --- | --- | --- |
| `upstream/v2/main` | Canonical active v2 development branch | Read-only |
| `upstream/main` | Canonical released v2 branch | Read-only |
| `origin/v2/main` | Exact fork mirror of `upstream/v2/main` | Fast-forward only; no fork changes |
| `origin/v2/extensions` | Validated fork integration branch | Stable; do not rewrite after collaborators depend on it |
| `origin/v2/proposal/extension-architecture` | Portable extension patch stack for upstream review | May be rebased with `--force-with-lease` |
| `origin/archive/v2/extensions-pre-2.3-sync` | Historical pre-2.3 extension stack | Immutable |
| `v2/feature/extension-*` | One phase or independently reviewable slice | Rebase before integration |

Configure the canonical remote once and disable pushes to it locally:

```sh
git remote add upstream https://github.com/modelcontextprotocol/inspector.git
git remote set-url --push upstream DISABLED
```

All intentional pushes go to `origin`, the `ObjectIsAdvantag/mcpinspector` fork.

## Current synchronization point

The extension stack was rebased onto reference `v2/main` commit `471b8653` on 2026-08-21. The previous stack is preserved at `archive/v2/extensions-pre-2.3-sync`.

Update this section in the same commit whenever the integration branch advances to a newer reference commit.

## Regular synchronization workflow

Synchronize before starting a phase, before proposing an upstream slice, and at least weekly while active development continues.

1. Fetch and inspect the reference branch:

   ```sh
   git fetch upstream --prune
   git log --oneline --left-right origin/v2/main...upstream/v2/main
   ```

2. Fast-forward the fork mirror without checking it out:

   ```sh
   git push origin upstream/v2/main:refs/heads/v2/main
   ```

3. Rebase each unpublished feature branch onto `upstream/v2/main` or the latest local extension integration point:

   ```sh
   git rebase upstream/v2/main
   ```

4. For the portable proposal stack, preserve the old tip and replay the extension commits:

   ```sh
   old_tip=$(git rev-parse v2/proposal/extension-architecture)
   git branch "archive/v2/proposal-$(date +%Y%m%d)" "$old_tip"
   git switch v2/proposal/extension-architecture
   git rebase upstream/v2/main
   git range-diff "$old_tip"~10.."$old_tip" upstream/v2/main..HEAD
   ```

   Adjust the old range rather than assuming it always contains ten commits. Every `!` entry in `range-diff` requires review; `=` entries are patch-equivalent.

5. Once other work depends on `v2/extensions`, merge the updated proposal stack into it rather than rewriting the integration branch. Before that point, a one-time rebase is acceptable if the old tip is archived and no collaborator depends on it.

6. Run the root formatter and full pre-push gate:

   ```sh
   npm install
   npm run format
   npm run ci
   ```

7. Push proposal history with `--force-with-lease`; push integration history normally.

## Conflict ownership

Resolve conflicts by preserving the newest reference behavior first, then reapplying the extension contract deliberately.

- `core/extensions/**`, extension plans, manifests, and the architecture specification: extension owner.
- `core/mcp/**`, auth, transport, and protocol-era behavior: reference implementation wins unless the extension contract requires an explicit adapter.
- `clients/web/src/App.tsx` and `InspectorView`: preserve reference state/lifecycle fixes; reapply only extension props and callbacks.
- package manifests and lockfiles: use the reference dependency model, then run `npm install` from the root. Never hand-merge lockfile internals.
- repository gates and scripts: prefer the newer reference guard. Do not retain a fork workaround when reference code now measures the invariant more accurately.
- `AGENTS.md` and Copilot instructions: preserve reference rules and add fork-only guidance only in the explicit experimental-fork section.

After resolving conflicts, inspect both behavior and patch identity with `git range-diff`; a clean textual merge is not proof of semantic equivalence.

## Preparing portable upstream work

The reference repository accepts detailed issues rather than unsolicited pull requests. The canonical tracker is [modelcontextprotocol/inspector#1025](https://github.com/modelcontextprotocol/inspector/issues/1025), **Placeholder: Inspector V2 Plugins Spec**, currently scheduled for v2.5.0. Upstream work therefore follows this sequence:

1. Search again for newer or split plugin/extension architecture issues before posting.
2. Add the architecture proposal to issue #1025 rather than opening a duplicate.
3. Link the architecture specification and the proposal branch; share prompts and screenshots rather than attaching a diff.
4. Ask maintainers to decide the trust model, persistence scope, package format, and public terminology before external code loading is proposed.
5. If maintainers approve implementation, offer independent slices in this order:
   - architecture and threat model;
   - static manifest, compatibility, and contribution contracts;
   - host-owned command plans;
   - artifact contracts and native-session export;
   - disconnected replay;
   - MCP Description 0.7 export;
   - negotiated-protocol applicability;
   - MCP Description 0.8.0 Draft 1 export as an immutable sibling format;
   - external Node host only after the brokered contracts are accepted.

Call this the **Inspector host extension architecture** or **Inspector plugin architecture** in upstream discussion so it is not confused with MCP protocol extensions.

## Upstream issue-comment draft

Post this to issue #1025 after confirming no newer issue supersedes it.

### The problem

The Inspector roadmap calls for a plugin SDK/API, but the current implementation has no stable boundary through which third parties can add Inspector-specific commands, artifact formats, validation, replay, or viewers. New integrations must either be maintained in the Inspector itself or couple directly to `InspectorClient`, stores, Commander, React, DOM, and filesystem internals. That makes optional functionality difficult to maintain and makes security, compatibility, and output isolation inconsistent across Web, CLI, and TUI.

### Solution you have in mind

Adopt a phased Inspector host extension architecture built around strict manifests, contribution registries, compatibility diagnostics, serializable DTOs, and host-owned command/artifact plans. Prove the contracts with built-ins before loading external code. External Node extensions would run in child processes behind framed, schema-validated JSON-RPC, explicit trust, timeouts, cancellation, crash isolation, and host-brokered capabilities. Browser logic would be a later, separate worker/iframe phase; extensions would never receive Inspector runtime objects or inject React UI.

An experimental fork has implemented and tested the built-ins-first phases: static contracts, command plans, versioned native-session record/replay, fresh schema-validated MCP Description 0.7 JSON/YAML export, and operation-scoped checks against the actual negotiated MCP version. The implementation is organized as independently reviewable phases, and the full architecture and threat boundaries are documented in `specification/v2_extension_architecture.md` on the proposal branch.

### Alternatives or workarounds

Continue adding every integration directly to the Inspector, maintain unrelated downstream forks, or expose internal runtime objects as an API. The first two increase maintenance drift; the last freezes internals and creates a substantially larger security and compatibility surface.

### Already built it locally?

The work was produced with `.github/prompts/implement-extension-architecture.prompt.md`, phase by phase, following the built-ins-first architecture specification. Proposal branch: `ObjectIsAdvantag/mcpinspector:v2/proposal/extension-architecture`. Evidence includes native-session disconnected replay, MCP Description JSON/YAML export, and modern-versus-legacy negotiated protocol applicability screenshots under the fork's ignored `pr-screenshots/` working-artifact directory.
