#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable


FORBIDDEN_PATH_RE = re.compile(
    r"(^|/)(data/(epis" r"odes|top" r"ics|\.cache)|epis" r"odes\.jsonl|top"
    r"ics\.jsonl|manifest\.json|"
    r"evidence|\.omo|tmp|dist|coverage|node_modules|\.venv)(/|$)|"
    r"\.(env|npmrc|pem|key|tgz|map|tsbuildinfo)$"
)
FORBIDDEN_TEXT_RE = re.compile(
    r"open" r"clone|len" r"ny|co" r"rpus-" r"mcp|co" r"rpus-" r"skill-kit|search_"
    r"transcripts|get_" r"epis" r"ode|data/" r"epis" r"odes|data/" r"top" r"ics|na" r"ver|"
    r"/home/burt/" r"Co" r"rpus|co" r"rpus-" r"data",
    re.IGNORECASE,
)
SECRET_TEXT_RE = re.compile(
    r"(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\s*=|KIMI_API_KEY\s*=|ANTHROPIC_API_KEY\s*=|"
    r"-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----)"
)


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=False)


def git_lines(args: list[str]) -> list[str]:
    result = run(["git", *args])
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or f"git {' '.join(args)} failed")
    return [line for line in result.stdout.splitlines() if line]


def read_tracked_text(file_path: str) -> str | None:
    try:
        data = Path(file_path).read_bytes()
    except FileNotFoundError:
        return None
    if b"\0" in data:
        return None
    return data.decode("utf-8", errors="ignore")


def scan_paths(paths: Iterable[str]) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for file_path in paths:
        if FORBIDDEN_PATH_RE.search(file_path):
            findings.append({"kind": "forbidden_path", "path": file_path})
        text = read_tracked_text(file_path)
        if text is None:
            continue
        if file_path not in {".gitignore", "scripts/scan-public-safety.py"} and FORBIDDEN_TEXT_RE.search(text):
            findings.append({"kind": "forbidden_text", "path": file_path})
        if SECRET_TEXT_RE.search(text):
            findings.append({"kind": "secret_like_text", "path": file_path})
    return findings


def scan_history() -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    object_lines = git_lines(["rev-list", "--objects", "--all"])
    for line in object_lines:
        parts = line.split(" ", 1)
        if len(parts) == 2 and FORBIDDEN_PATH_RE.search(parts[1]):
            findings.append({"kind": "history_forbidden_path", "path": parts[1]})

    revisions = git_lines(["rev-list", "--all"])
    if not revisions:
        return findings
    grep = run(
        [
            "git",
            "grep",
            "-I",
            "-n",
            "-E",
            FORBIDDEN_TEXT_RE.pattern,
            *revisions,
            "--",
            ".",
            ":(exclude).gitignore",
            ":(exclude)scripts/scan-public-safety.py",
        ]
    )
    if grep.returncode == 0:
        findings.append({"kind": "history_forbidden_text", "path": "git grep output"})
    elif grep.returncode not in (1, 128):
        findings.append({"kind": "history_scan_error", "path": grep.stderr.strip()})
    return findings


def write_evidence(path: str | None, payload: dict[str, object]) -> None:
    if not path:
        return
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tracked", action="store_true", help="scan git-tracked files")
    parser.add_argument("--history", action="store_true", help="scan committed object names")
    parser.add_argument("--evidence", help="write JSON evidence outside the repository")
    args = parser.parse_args()

    if not args.tracked and not args.history:
        args.tracked = True

    findings: list[dict[str, str]] = []
    tracked_files: list[str] = []
    if args.tracked:
        tracked_files = git_lines(["ls-files"])
        findings.extend(scan_paths(tracked_files))
    if args.history:
        findings.extend(scan_history())

    payload = {
        "ok": not findings,
        "trackedFileCount": len(tracked_files),
        "findings": findings,
    }
    write_evidence(args.evidence, payload)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
