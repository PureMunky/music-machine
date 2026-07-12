#!/usr/bin/env bash
#
# pr-comment.sh — post or update a single "sticky" comment on a pull request.
#
#   tools/pr-comment.sh <pr-number> <body>
#
# The comment is tagged with a hidden marker; subsequent runs edit that same
# comment instead of posting a new one, so a PR gets one tidy preview comment
# that updates in place. Uses the `gh` CLI (preinstalled on GitHub runners);
# requires GH_TOKEN and GITHUB_REPOSITORY.
set -euo pipefail

PR="${1:?usage: pr-comment.sh <pr-number> <body>}"
BODY="${2:?usage: pr-comment.sh <pr-number> <body>}"
MARKER="<!-- song-preview-bot -->"
FULL="${MARKER}
${BODY}"

# Find an existing sticky comment (match the marker in the body).
existing="$(gh api "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" --paginate \
  --jq "map(select(.body | contains(\"${MARKER}\"))) | .[0].id // empty")"

if [ -n "$existing" ]; then
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${existing}" \
    -f body="$FULL" >/dev/null
  echo "Updated sticky comment ${existing}."
else
  gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${PR}/comments" \
    -f body="$FULL" >/dev/null
  echo "Posted sticky comment."
fi
