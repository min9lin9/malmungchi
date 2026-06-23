# Malmungchi

[English README](./README.md)

Malmungchi는 Codex와 함께 쓰는 로컬 문서 기억 서버이자 페르소나 워크플로 키트입니다.
내 문서를 어디론가 보내기 전에, 일단 내 컴퓨터 안에서 잘 정리하고 찾아 쓰자는 쪽에 가깝습니다.

Markdown이나 JSONL로 만든 author source를 가져오고, MCP 또는 HTTP로 검색하고, 근거가 붙은 export bundle을 만들고, 그 근거를 바탕으로 선을 넘지 않는 simulated persona를 생성합니다. 기억력은 빌려주되, 허언증은 빌려주지 않는 것이 목표입니다.

## 빠른 시작

필요한 것: Bun 1.3 이상.

npm으로 설치:

```bash
npm install -g malmungchi
malmungchi --help
```

소스에서 실행:

```bash
git clone https://github.com/min9lin9/malmungchi.git
cd malmungchi
bun install
bun run typecheck
bun test
bun run start:http
```

source 가져오기:

```bash
curl -sS -X POST http://127.0.0.1:3000/malmungchi/import-author \
  -H 'content-type: application/json' \
  -d '{"authorId":"demo","fileName":"note.md","fileContent":"# Product Note\n\nCustomer interviews guide planning."}'
```

검색하고 export하기:

```bash
curl -sS 'http://127.0.0.1:3000/search?q=customer&limit=3'
curl -sS 'http://127.0.0.1:3000/malmungchi/sources/author:demo/export?includeHistory=true'
```

## Import 경로

- HTTP author import는 Markdown(`.md`)과 JSONL(`.jsonl`)을 받습니다.
- `malmungchi ingest <input-dir> --out <workspace>`는 로컬 Markdown(`.md`)과 JSON(`.json`) 파일을 persona와 provenance workflow에 맞게 normalize합니다.

## MCP 도구

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

## 내부 구조

- 문서 lifecycle과 검색 orchestration: `src/service/document-service.ts`
- 공유 document model: `src/domain/document.ts`
- source lifecycle과 export: `src/service/source-operations.ts`
- persona, panel, room, benchmark workflow: `skill-kit/`

## CLI와 Codex skill

CLI는 `malmungchi`로 실행합니다:

```bash
malmungchi ingest ./notes --out ./workspace
malmungchi persona --help
malmungchi panel --help
malmungchi room --help
```

소스 checkout에서는 Bun script로도 같은 명령을 쓸 수 있습니다:

```bash
bun run malmungchi ingest ./notes --out ./workspace
bun run malmungchi persona --help
bun run malmungchi panel --help
bun run malmungchi room --help
```

Codex에서 `/malmungchi`로 부르고 싶다면 skill을 연결합니다:

```bash
mkdir -p ~/.codex/skills
ln -sfn "$(pwd)/skill-kit/skills/malmungchi" ~/.codex/skills/malmungchi
```

그다음 새 Codex 세션을 열고 `/malmungchi`를 호출하면 됩니다.

로컬 점검:

```bash
bun run qa:e2e
bun run security:check
bun run validate:skills
bun run eval4sim:doctor
bun run benchmark:persona --fixture fixtures/persona-benchmark --out /tmp/malmungchi-persona.json
```

## 환경 변수

- `MALMUNGCHI_TRANSPORT`: `stdio` 또는 `http`
- `MALMUNGCHI_DATA_DIR`: 로컬 저장소 디렉터리, 기본값 `./data`
- `MALMUNGCHI_IMPORT_DIR`: local import 허용 root
- `MALMUNGCHI_API_KEY`: health를 제외한 HTTP route의 optional bearer token
- `MALMUNGCHI_SEARCH_ENGINE`: `flexsearch` 또는 `meilisearch`
- `EMBED_PROVIDER`: `openai` 또는 `kimi`
- `EMBED_MODEL`: embedding model 이름

Provider key는 환경 변수에서만 읽습니다. 테스트는 deterministic fake provider를 쓰므로 실제 model credential이 없어도 됩니다.

## 라이선스

MIT
