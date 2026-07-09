#!/bin/bash
# PreToolUse hook for the Bash tool. Reads the tool call as JSON on stdin,
# blocks a short list of unambiguously destructive commands, warns (without
# blocking) on ones that are sometimes legitimate. Exit 2 = block (stderr is
# shown to Claude); exit 0 = allow.
#
# Wired in .claude/settings.json under hooks.PreToolUse (matcher: "Bash").

set -euo pipefail

input="$(cat)"
command="$(echo "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))' 2>/dev/null || echo "")"

[ -z "$command" ] && exit 0

block() {
  echo "BLOCKED by .claude/hooks/validate-bash.sh: $1" >&2
  exit 2
}

warn() {
  echo "WARNING from .claude/hooks/validate-bash.sh: $1" >&2
}

# Unambiguously destructive — always block.
if echo "$command" | grep -qE 'rm[[:space:]]+.*-[a-zA-Z]*r[a-zA-Z]*f.*(\s|^)(/|~|\$HOME)(\s|$)'; then
  block "rm -rf against a root/home path — this deletes far more than intended."
fi

if echo "$command" | grep -qE 'git[[:space:]]+push[[:space:]]+.*--force([[:space:]]|$).*(main|master)'; then
  block "force-push to main/master — can overwrite others' work on a shared branch."
fi

if echo "$command" | grep -qE '(^|[[:space:]])docker([[:space:]]+compose)?[[:space:]]+.*down[[:space:]]+.*-v(\s|$)'; then
  block "'docker compose down -v' drops the postgres/redis/ml-logs volumes for this project — confirm with the user first (see .claude/skills/deploy/SKILL.md)."
fi

# Risky but sometimes legitimate — warn, don't block.
if echo "$command" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard'; then
  warn "'git reset --hard' discards uncommitted work — make sure it's intended."
fi

if echo "$command" | grep -qE '(^|[[:space:]])(psql|python3?[[:space:]]+.*run_(ml_)?migration)'; then
  warn "touching the database/migrations directly — double-check this targets the intended environment, not production."
fi

exit 0
