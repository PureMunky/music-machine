#!/usr/bin/env bash
#
# gh-pages.sh — publish (or remove) a directory on the `gh-pages` branch.
#
# The published site is built by tools/build-site.js into ./site. This script
# syncs that into the gh-pages branch, which GitHub Pages serves. It supports
# per-PR preview subfolders so a pull request can be played in the browser
# before it is merged.
#
#   tools/gh-pages.sh publish            # deploy ./site to the site root
#   tools/gh-pages.sh publish pr-preview/pr-42   # deploy ./site to a subfolder
#   tools/gh-pages.sh remove  pr-preview/pr-42   # delete a subfolder
#
# A root publish preserves the whole pr-preview/ tree, so deploying main never
# wipes open PR previews. Uses only the built-in GITHUB_TOKEN — no external
# actions. Requires: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), and (for
# commit messages) GITHUB_SHA.
set -euo pipefail

ACTION="${1:?usage: gh-pages.sh <publish|remove> [subdir]}"
SUBDIR="${2:-}"
SRC="${GITHUB_WORKSPACE:-$PWD}/site"
# GH_PAGES_REMOTE overrides the push target (used by local tests); in CI the
# built-in token authenticates against the repo over HTTPS.
REPO_URL="${GH_PAGES_REMOTE:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
WORK="$(mktemp -d)"

# Check out the existing gh-pages branch, or start a fresh orphan one.
if git clone --quiet --no-checkout --depth 1 --branch gh-pages "$REPO_URL" "$WORK" 2>/dev/null; then
  cd "$WORK"
  git checkout --quiet gh-pages
else
  cd "$WORK"
  git init --quiet
  git remote add origin "$REPO_URL"
  git checkout --quiet --orphan gh-pages
fi

git config user.name  "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

case "$ACTION" in
  publish)
    if [ ! -d "$SRC" ]; then echo "No ./site to publish — run tools/build-site.js first." >&2; exit 1; fi
    if [ -z "$SUBDIR" ]; then
      # Root deploy: clear everything except the preview tree, then copy in.
      find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'pr-preview' -exec rm -rf {} +
      cp -R "$SRC"/. .
    else
      rm -rf "$SUBDIR"
      mkdir -p "$SUBDIR"
      cp -R "$SRC"/. "$SUBDIR"/
    fi
    ;;
  remove)
    if [ -z "$SUBDIR" ]; then echo "remove requires a subdir" >&2; exit 1; fi
    rm -rf "$SUBDIR"
    ;;
  *)
    echo "unknown action: $ACTION" >&2; exit 1 ;;
esac

# .nojekyll: serve files verbatim (no Jekyll pipeline).
touch .nojekyll

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed on gh-pages."
  exit 0
fi
git commit --quiet -m "${ACTION} ${SUBDIR:-<root>} @ ${GITHUB_SHA:0:7}"

# Jobs are serialized by a shared concurrency group, but retry on the off
# chance of a racing push.
for attempt in 1 2 3; do
  if git push --quiet origin gh-pages; then
    echo "gh-pages: ${ACTION} ${SUBDIR:-<root>} ✓"
    exit 0
  fi
  echo "push failed (attempt ${attempt}); refreshing and retrying…" >&2
  git fetch --quiet origin gh-pages && git rebase --quiet origin/gh-pages || true
  sleep $((attempt * 2))
done
echo "gh-pages push failed after retries." >&2
exit 1
