# Reproducible Signal K harness for capturing KIP image-widget screenshots.
#
# Installs the STANDALONE sk-image plugin plus the KIP webapp into a security-OFF Signal K server, so
# the image library, thumbnails and on-disk cache all work without a login. No VOLUME on the config
# dir, so the bake survives at runtime.
#
# sk-image requires Node.js 24+. The base image below must therefore provide Node 24 — pin a
# signalk-server tag built on Node 24 (or a node:24 base with signalk-server installed) if the
# `latest` tag lags behind.
FROM signalk/signalk-server:latest
USER node
COPY --chown=node:node signalk-config/ /home/node/.signalk/
COPY --chown=node:node kip.tgz /tmp/kip.tgz
# Install the standalone image plugin (sk-image) and the KIP webapp (this repo, packed to kip.tgz).
# sk-image ships a prebuilt sharp; --omit=dev keeps the image lean.
RUN cd /home/node/.signalk \
 && npm install --no-audit --no-fund --omit=dev sk-image /tmp/kip.tgz \
 && rm /tmp/kip.tgz
