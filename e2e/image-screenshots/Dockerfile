# Reproducible Signal K harness for capturing KIP image-widget screenshots.
# Bakes the (integrated) KIP plugin + webapp and a security-OFF config into the image so the
# image library, thumbnails and on-disk cache all work without a login. No VOLUME on the official
# image's config dir, so the bake survives at runtime.
FROM signalk/signalk-server:latest
USER node
COPY --chown=node:node signalk-config/ /home/node/.signalk/
COPY --chown=node:node kip.tgz /tmp/kip.tgz
# Installs @mxtommy/kip (webapp + plugin) and its native deps (sharp) for THIS platform/arch.
RUN cd /home/node/.signalk && npm install --no-audit --no-fund --omit=dev /tmp/kip.tgz && rm /tmp/kip.tgz
