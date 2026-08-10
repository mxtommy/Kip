#!/usr/bin/env bash
# Brings up the KIP image-widget screenshot harness and seeds it.
#   Prereq: kip.tgz (the packed KIP webapp — `npm run build:prod && npm pack`, see README) next to
#           this script. The Dockerfile installs the standalone sk-image plugin from npm alongside it.
#   ./run.sh         build + start + seed
#   ./run.sh --down  stop and remove
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" == "--down" ]]; then docker compose down -v; exit 0; fi
[[ -f kip.tgz ]] || { echo "!! kip.tgz missing — see README to pack the KIP webapp."; exit 1; }
echo "==> Building + starting (open Signal K on :3015 with the KIP webapp + the standalone sk-image plugin)"
docker compose up -d --build
echo "==> Waiting for Signal K"
for i in $(seq 1 60); do curl -fsS http://localhost:3015/signalk >/dev/null 2>&1 && break; sleep 2; done
echo "==> Seeding sample images"
./seed.sh
cat <<EOF

Ready.
  KIP webapp:   http://localhost:3015/@mxtommy/kip
  Image library: http://localhost:3015/signalk/v1/api/sk-image/images
  Image cache:  http://localhost:3015/signalk/v1/api/sk-image/images/cache
  Stop:         ./run.sh --down
EOF
