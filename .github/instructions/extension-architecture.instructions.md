---
description: "Use when implementing or reviewing Inspector extension architecture, extension manifests, contribution registries, command or artifact plans, built-in extensions, extension hosts, or extension UI."
applyTo:
  - "core/extensions/**"
  - "clients/cli/src/extensions/**"
  - "clients/cli/__tests__/**"
  - "clients/web/src/lib/extensions/**"
  - "clients/web/src/components/extensions/**"
  - "clients/web/src/test/core/extensions/**"
  - "clients/web/src/test/integration/extensions/**"
  - "specification/v2_extension_architecture.md"
---

# Extension architecture constraints

- [The extension architecture specification](../../specification/v2_extension_architecture.md) is the source of truth for this experimental work.
- Prove contracts with built-ins before introducing external extension loading.
- Give extensions only brokered, serializable DTO APIs; never expose `InspectorClient`, stores, Commander, React, DOM, or filesystem objects.
- Keep artifact format, operation, encoding, and version as independent dimensions.
- Do not register or advertise MCP Description 0.8 before an authoritative schema exists.
- Preserve the requested phase scope, tests, documentation deliverables, and security boundaries; do not implement later phases speculatively.
