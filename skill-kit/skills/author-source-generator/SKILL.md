---
name: author-source-generator
description: Convert normalized Corpus Skill Kit elements into Corpus author JSONL or Markdown and import through public Corpus HTTP/MCP surfaces.
---

# Author Source Generator

Use this skill after ingestion has produced `normalized/*/elements.jsonl`.

Default to a dry run before live Corpus import:

```bash
/home/burt/.local/bin/skill-kit author-source <workspace> --author-id <slug> --dry-run
```

Live Corpus import uses `--corpus-url`, but must be verified against the active Corpus endpoint schema before release use. Remote Corpus URLs require explicit opt-in. Never log request bodies or credentials.
