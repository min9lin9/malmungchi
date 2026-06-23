# Malmungchi

Malmungchi is a local document memory server and persona workflow kit for Codex.
It imports user-provided Markdown or JSONL author sources, searches them through
MCP or HTTP, exports evidence bundles with provenance, and uses those exports to
generate bounded simulated personas.

This repository does not include private document collections, private evidence,
generated caches, or provider credentials.

## Quickstart

```bash
bun install
bun run typecheck
bun test
bun run start:http
```

Import a source:

```bash
curl -sS -X POST http://127.0.0.1:3000/malmungchi/import-author \
  -H 'content-type: application/json' \
  -d '{"authorId":"demo","fileName":"note.md","fileContent":"# Product Note\n\nCustomer interviews guide planning."}'
```

Search and export:

```bash
curl -sS 'http://127.0.0.1:3000/search?q=customer&limit=3'
curl -sS 'http://127.0.0.1:3000/malmungchi/sources/author:demo/export?includeHistory=true'
```

## MCP Tools

- `search_documents`
- `get_document`
- `compare_search_explain`
- `import_author_source`
- `list_sources`
- `get_source`
- `refresh_source`
- `get_source_status`
- `compact_source_memory`
- `export_source`
- `get_source_history`
- `delete_source`
- `get_malmungchi_stats`
- `get_llm_status`

## Internal Shape

- Core document lifecycle and search orchestration: `src/service/document-service.ts`
- Shared document model: `src/domain/document.ts`
- Source lifecycle and export logic: `src/service/source-operations.ts`
- Persona, panel, room, and benchmark workflows: `skill-kit/`

## CLI And Skills

The bundled CLI is exposed as `malmungchi`:

```bash
bun run malmungchi persona --help
bun run malmungchi panel --help
bun run malmungchi room --help
```

Available local checks:

```bash
bun run qa:e2e
bun run security:check
bun run validate:skills
bun run eval4sim:doctor
bun run benchmark:persona --fixture fixtures/persona-benchmark --out /tmp/malmungchi-persona.json
```

## Environment

- `MALMUNGCHI_TRANSPORT`: `stdio` or `http`
- `MALMUNGCHI_DATA_DIR`: local storage directory, default `./data`
- `MALMUNGCHI_IMPORT_DIR`: allowed local import root
- `MALMUNGCHI_API_KEY`: optional bearer token for HTTP routes except health
- `MALMUNGCHI_SEARCH_ENGINE`: `flexsearch` or `meilisearch`
- `EMBED_PROVIDER`: `openai` or `kimi`
- `EMBED_MODEL`: embedding model name

Provider keys are read only from environment variables. Tests use deterministic
fake providers and do not require live model credentials.

## Data Policy

Only synthetic fixtures are committed. Runtime source data belongs under the
configured data directory and should not be committed unless it is intentionally
created as a small public fixture.

## License

MIT
