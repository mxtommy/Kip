#!/usr/bin/env bash
# Uploads the realistic sample marine diagrams into the shared image library, then warms the cache
# (raster variants) so the Media → Image Cache card shows a real on-disk size.
set -euo pipefail
cd "$(dirname "$0")"
BASE="${KIP_SK_URL:-http://localhost:3015}"
upload() { # file  mime
  curl -fsS -X POST "$BASE/plugins/kip/images" -F "file=@${1};type=${2};filename=$(basename "$1")" >/dev/null \
    && echo "  uploaded: $(basename "$1")" || echo "  FAILED: $(basename "$1")"
}
for f in sample-images/*.svg; do [ -e "$f" ] && upload "$f" "image/svg+xml"; done
for f in sample-images/*.png; do [ -e "$f" ] && upload "$f" "image/png"; done
echo "Warming the cache (raster variants)…"
curl -fsS "$BASE/plugins/kip/images" | python3 -c "import sys,json;[print(i['id'],i['format']) for i in json.load(sys.stdin)]" | while read -r id fmt; do
  [ "$fmt" = "svg" ] && continue
  for w in 160 320 640; do curl -fsS -o /dev/null "$BASE/plugins/kip/images/${id}?w=${w}" || true; done
done
echo "Done. Cache: $(curl -fsS "$BASE/plugins/kip/images/cache")"
