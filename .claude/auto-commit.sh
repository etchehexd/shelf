#!/usr/bin/env bash
#
# Auto-commit and push, run by the Stop hook at the end of every Claude Code turn.
#
# The safety net, not the main event: Claude still writes real commits with real
# messages for substantive work. This catches whatever is left over so nothing
# is ever sitting uncommitted at the end of a turn.
#
# Pushes the CURRENT branch rather than a hardcoded `main`. The workflow is
# trunk-based so that is normally main anyway — but hardcoding it would mean a
# stray checkout silently pushed the wrong branch's work to the trunk.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# Not a repo, or a repo mid-rebase/merge — leave it alone either way.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git_dir=$(git rev-parse --git-dir 2>/dev/null)
for marker in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD BISECT_LOG; do
  [ -e "$git_dir/$marker" ] && exit 0
done

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ "$branch" = "HEAD" ] && exit 0   # detached; committing here strands the work

git add -A >/dev/null 2>&1

# Nothing staged means nothing to do. This is the common case — most turns end
# with Claude having already committed — so it must be silent.
git diff --cached --quiet 2>/dev/null && exit 0

files=$(git diff --cached --name-only | wc -l | tr -d ' ')

git commit -q \
  -m "chore(auto): uncommitted changes from a Claude Code session" \
  -m "Swept up by the Stop hook. See the session transcript for context." \
  -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" >/dev/null 2>&1 || exit 0

sha=$(git rev-parse --short HEAD 2>/dev/null)

# A failed push must be loud. Silently committing but not pushing is the worst
# outcome: it looks like it worked and the work never leaves the machine.
if git push -q origin HEAD >/dev/null 2>&1; then
  printf '{"systemMessage":"Auto-commit %s — %s file(s) pushed to %s"}\n' "$sha" "$files" "$branch"
else
  printf '{"systemMessage":"Auto-commit %s (%s file(s)) succeeded but the push FAILED. Run: git push origin %s"}\n' "$sha" "$files" "$branch"
fi
