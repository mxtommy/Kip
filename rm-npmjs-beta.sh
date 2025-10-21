#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required (brew install jq)" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package-name> [deprecation-message] [channel]" >&2
  echo "Example: $0 mypkg \"Deprecated: use >=1.2.0\" beta" >&2
  exit 1
fi

PKG="$1"; shift || true
MSG="${1-Deprecated prerelease: please install a stable version}"; [[ $# -gt 0 ]] && shift || true
CHANNEL="${1-beta}"

# Get all published versions
versions_json=$(npm view "$PKG" versions --json 2>/dev/null || true)
if [[ -z "${versions_json:-}" || "${versions_json}" == "null" ]]; then
  echo "No versions found or package not accessible: $PKG" >&2
  exit 1
fi

# Select prereleases that contain -<channel>, e.g. -beta
VERSIONS=$(printf '%s' "$versions_json" \
  | jq -r --arg ch "$CHANNEL" 'if type=="array" then . else [.] end | .[] | select(test("-(\($ch))","i"))')

if [[ -z "${VERSIONS:-}" ]]; then
  echo "No $CHANNEL versions found for $PKG."
  exit 0
fi

echo "Found $CHANNEL versions for $PKG:"
printf '  %s\n' $VERSIONS

read -r -p "Deprecate these versions with message: \"$MSG\"? [y/N] " ans
case "$ans" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; exit 0 ;;
esac

set -x
for v in $VERSIONS; do
  npm deprecate "$PKG@$v" "$MSG"
done
set +x

echo "Done."
