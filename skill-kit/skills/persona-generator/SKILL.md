---
name: persona-generator
description: Generate bounded, evidence-grounded simulated personas from Malmungchi sources with provider-neutral LLM support, provenance validation, Eval4Sim, and PPS gates.
---

# Persona Generator

Use this skill to generate a simulated persona from Malmungchi author sources. Malmungchi is the evidence/search source of truth; local workspace generation is only for offline fixtures. The output must say it is not the real person and every strict claim must cite source evidence.

Run:

```bash
/home/burt/.local/bin/skill-kit author-source <workspace> --author-id <slug> --malmungchi-url http://127.0.0.1:3000
/home/burt/.local/bin/skill-kit persona --author-id <slug> --malmungchi-url http://127.0.0.1:3000 --provider fake --out persona.json --markdown persona.md
/home/burt/.local/bin/skill-kit persona tag persona.json --category founder --category vc
/home/burt/.local/bin/skill-kit persona-eval fixtures/validation-sample --provider fake --out evidence/persona-quality.json
```

OpenAI is the default provider selection and KIMI is selectable by config, but current release gates validate credential requirements rather than real provider quality. Unit and smoke tests should use `fake`.

Persona benchmark commands:

```bash
/home/burt/.local/bin/skill-kit clone export persona.json --out persona-clone --force
/home/burt/.local/bin/skill-kit clone import persona-clone --out persona-imported.json
/home/burt/.local/bin/skill-kit chat persona-imported.json --provider fake --prompt "What next?" --out chat.md --json chat.json
/home/burt/.local/bin/skill-kit provider status --provider fake
/home/burt/.local/bin/skill-kit benchmark:persona --author-id <slug> --malmungchi-url http://127.0.0.1:3000 --out persona-quality.json
```

Provider diagnostics include `openai-compatible`, `codex`, `claude-code`, `ollama`, and `fake`. Tests do not call live providers.
