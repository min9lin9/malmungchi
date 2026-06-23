---
name: author-source-generator
description: Convert normalized Malmunchi elements into Malmunchi author JSONL or Markdown and import through public Malmunchi HTTP/MCP surfaces.
---

# Author Source Generator

Use this skill after ingestion has produced `normalized/*/elements.jsonl`.

Default to a dry run before live Malmunchi import:

```bash
/home/burt/.local/bin/skill-kit author-source <workspace> --author-id <slug> --dry-run
```

Live Malmunchi import uses `--malmunchi-url`, but must be verified against the active Malmunchi endpoint schema before release use. Remote Malmunchi URLs require explicit opt-in. Never log request bodies or credentials.
