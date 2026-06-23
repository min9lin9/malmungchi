---
name: malmungchi
description: Use Malmungchi for local source storage, search, lifecycle export, author-source generation, personas, persona benchmarks, panels, and rooms.
---

# Malmungchi Skill

Use this skill when the user mentions Malmungchi, `/malmungchi`, source import/export,
source-backed personas, persona benchmarks, panel debate, or room debate.

Local install:
- MCP server: `<repo>/src/main.ts`
- CLI: `bun run malmungchi`
- Skills: `<repo>/skill-kit/skills/*`

Routing:
- Use Malmungchi core for source storage, search, source lifecycle, refresh,
  history, export, and provenance.
- Use the bundled CLI for local normalization, author source generation,
  persona generation, offline fixture workflows, persona benchmark, panel
  debate, and room debate.

Quick commands:
```bash
bun run malmungchi --help
bun run benchmark:persona --fixture fixtures/persona-benchmark --out /tmp/persona-benchmark.json
```

Boundary:
Do not duplicate source lifecycle, search, or export behavior in persona code.
If persona quality is weak, improve source-backed evidence and benchmark flow
first.
