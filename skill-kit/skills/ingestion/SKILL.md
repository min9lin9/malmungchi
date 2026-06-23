---
name: ingestion
description: Normalize local Markdown and JSON source folders into Corpus Skill Kit raw/normalized document layout while preserving Korean text and provenance.
---

# Ingestion

Use this skill when a user needs local `.md` or `.json` files normalized for Corpus author import or persona generation.

Run:

```bash
/home/burt/.local/bin/skill-kit ingest <input-dir> --out <workspace>
/home/burt/.local/bin/skill-kit knowledge add <workspace> <file-or-folder> --source-label <label>
/home/burt/.local/bin/skill-kit chunk <workspace> --out <workspace>/chunks
```

Only Markdown and JSON are supported. Reject traversal, unsafe absolute paths, symlink escapes, and generated/private output paths unless explicitly sanitized.

`knowledge add` also accepts optional `--category`, `--source-type`, and `--published-at`. URL and YouTube source types are metadata-only; this kit does not fetch remote content.
