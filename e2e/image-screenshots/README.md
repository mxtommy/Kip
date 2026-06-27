# KIP image-widget screenshot harness

Reproducible, **open** (no-login) Signal K + KIP stack with the `kip` image plugin, seeded with
realistic marine diagrams, for capturing the Image widget help screenshots.

## Why it exists
The image widget is split across three PRs/branches:
`feat/image-assets-server` (1080, the plugin), `feat/image-assets-client` (1081),
`feat/image-assets-config-ui` (1082, the webapp/config UI). No single branch runs end to end, so this
harness builds the **integrated** package and runs it in a throwaway container.

## Build the package (kip.tgz)
From a clone of KIP, integrate the server branch with the UI branch and pack:
```
git checkout feat/image-assets-config-ui
git checkout -b tmp/image-harness
git merge --no-ff feat/image-assets-server
npm install && npm run build:all      # build:plugin + build:prod
npm pack                              # -> mxtommy-kip-<v>.tgz
cp mxtommy-kip-*.tgz <this-dir>/kip.tgz
```
`npm pack` ships `plugin/**` + `public/**`; the Dockerfile's `npm install` then resolves native deps
(`sharp`) for the container's platform.

## Run
```
./run.sh          # build image, start on :3015, seed sample images + warm the cache
./run.sh --down   # stop + remove
```
- KIP webapp: http://localhost:3015/@mxtommy/kip
- Image cache: http://localhost:3015/plugins/kip/images/cache

Security is OFF (open) so the gallery, thumbnails and cache work without a login. Do not expose it.

## Updating screenshots as the UI evolves
Rebuild `kip.tgz` (above) and `./run.sh` again, then re-capture. Sample images live in
`sample-images/` (SVG diagrams + PNG rasters; the PNGs populate the raster cache).
