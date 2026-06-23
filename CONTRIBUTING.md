# Contributing

Malmunchi is kept public-safe by default. Contributions should use synthetic
fixtures and must not include private corpora, generated caches, provider keys,
or local evidence.

Before opening a pull request, run:

```bash
bun run typecheck
bun run lint
bun test
bun run ci:local
bun run validate:skills
bun run security:check
python3 scripts/scan-public-safety.py --tracked --history
```

Keep MCP and HTTP adapters thin. Shared document lifecycle, search, and source
logic belongs under `src/`; persona and skill workflows belong under
`skill-kit/`.
