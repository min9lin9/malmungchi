# Agent Guidelines

## Project

- Name: `malmungchi`
- Runtime: Bun 1.3+
- Stack: TypeScript strict, Elysia, FlexSearch, MCP SDK, Zod
- Test runner: `bun test`
- Formatter/linter: Biome

## Architecture

- Core storage/search/lifecycle code lives under `src/`.
- MCP and HTTP adapters stay thin; shared bootstrap is in `src/bootstrap.ts`.
- Persona, panel, room, benchmark, and Codex skill workflows live under
  `skill-kit/` and consume source exports instead of reimplementing storage.

## Data Boundary

- Do not commit runtime source data, generated caches, evidence, provider keys,
  or private document collections.
- Public fixtures must be small and synthetic.
- The public v0 source lifecycle is `author:` source based. Do not add bundled
  private document collections or crawler-specific import routes without a new
  plan.

## Verification

Before finishing code changes, run:

```bash
bun run typecheck
bun run lint
bun test
bun run ci:local
bun run validate:skills
bun run security:check
```
