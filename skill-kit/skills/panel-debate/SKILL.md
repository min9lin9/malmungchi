---
name: panel-debate
description: Orchestrate bounded 1-5 persona panel debates for 1-5 rounds with cited claims, JSON/Markdown outputs, and moderator summaries.
---

# Panel Debate

Use this skill when the user wants a bounded debate among generated persona JSON files.

Run:

```bash
/home/burt/.local/bin/skill-kit debate --persona a.json --persona b.json --question "What should we prioritize?" --rounds 2 --out debate.md --json debate.json
/home/burt/.local/bin/skill-kit panel --category vc --persona-dir ./personas --question "What should we prioritize?" --out panel.md --json panel.json
/home/burt/.local/bin/skill-kit room ask --persona a.json --persona b.json --question "What should we prioritize?" --out room.md --json room.json
```

Reject more than five personas or five rounds. Every turn must cite persona evidence.

Persona benchmark behavior:

- `panel` includes fixed category lens metadata.
- `room ask` remains stateless and includes routing metadata.
- `benchmark:persona` reports local parity dimensions without live LLM judging.
