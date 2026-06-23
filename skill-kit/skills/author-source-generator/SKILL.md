---
name: author-source-generator
description: Convert normalized Malmungchi elements into Malmungchi author JSONL or Markdown and import through public Malmungchi HTTP/MCP surfaces.
---

# Author Source Generator

Use this skill after ingestion has produced `normalized/*/elements.jsonl`.

Default to a dry run before live Malmungchi import:

```bash
/home/burt/.local/bin/skill-kit author-source <workspace> --author-id <slug> --dry-run
```

Live Malmungchi import uses `--malmungchi-url`, but must be verified against the active Malmungchi endpoint schema before release use. Remote Malmungchi URLs require explicit opt-in. Never log request bodies or credentials.
