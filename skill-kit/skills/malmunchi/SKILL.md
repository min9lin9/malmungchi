---
name: malmunchi
description: Use Malmunchi for local source storage, search, lifecycle export, author-source generation, personas, persona benchmarks, panels, and rooms.
---

# Malmunchi Skill

Use this skill when the user mentions Malmunchi, `/malmunchi`, source import/export,
source-backed personas, persona benchmarks, panel debate, or room debate.

Local install:
- MCP server: `<repo>/src/main.ts`
- CLI: `bun run malmunchi`
- Skills: `<repo>/skill-kit/skills/*`

Routing:
- Use Malmunchi core for source storage, search, source lifecycle, refresh,
  history, export, and provenance.
- Use the bundled CLI for local normalization, author source generation,
  persona generation, offline fixture workflows, persona benchmark, panel
  debate, and room debate.

Quick commands:
```bash
bun run malmunchi --help
bun run benchmark:persona --fixture fixtures/persona-benchmark --out /tmp/persona-benchmark.json
```

Boundary:
Do not duplicate source lifecycle, search, or export behavior in persona code.
If persona quality is weak, improve source-backed evidence and benchmark flow
first.
