# KIP image-widget screenshot harness

A reproducible Signal K + KIP stack for capturing the Image widget help screenshots and for
verifying the widget against the **real, standalone** image plugin.

## Architecture (post-split)

Image storage/processing is no longer part of KIP. It lives in the standalone **`sk-image`** Signal K
plugin (published on npm, in the App Store). KIP ships only the display widget + config UI, which talk
to the plugin's crew-reachable REST API at **`/signalk/v1/api/sk-image`**. So this harness installs two
separate packages into a Signal K server:

- **`sk-image`** — the image plugin. **Requires Node.js 22.13+** on the server.
- **`@mxtommy/kip`** — the webapp (this repo), served at `/@mxtommy/kip`.

## Build the KIP webapp package (kip.tgz)

From a clone of KIP:

```
npm install && npm run build:prod   # -> public/
npm pack                            # -> mxtommy-kip-<v>.tgz  (ships public/**)
cp mxtommy-kip-*.tgz e2e/image-screenshots/kip.tgz
```

`npm pack` ships `public/**`; the container installs `sk-image` alongside it and resolves the plugin's
native dep (`sharp`) for the container's platform.

## Run (open server — screenshots)

```
./run.sh          # build image, start on :3015, seed sample images + warm the cache
./run.sh --down   # stop + remove
```

- KIP webapp: http://localhost:3015/@mxtommy/kip
- Image library (public read): http://localhost:3015/signalk/v1/api/sk-image/images
- Image cache: http://localhost:3015/signalk/v1/api/sk-image/images/cache

Security is OFF (open), so the gallery, thumbnails, upload and cache all work without a login. Do not
expose it. Sample images live in `sample-images/` (SVG diagrams + PNG rasters; the PNGs populate the
raster cache).

## Verify on a SECURED server (role behavior)

The widget's important behavior only shows with server security ON. To check it, enable security on the
server (`signalk-server` admin UI → Security, or add a `security` block to `settings.json`) and create
two accounts — one **admin/read-write**, one **read-only** — then confirm, in KIP pointed at the server:

- **Anonymous / read-only crew can VIEW** images (the widget renders; the config gallery lists them),
  because reads on `/signalk/v1/api/sk-image` are public. This is the reason KIP must target that mount
  and not the admin-gated `/plugins/sk-image` alias.
- A **read-only** account gets a clear "your account is read-only" message on upload/delete (HTTP 403),
  not a "check your connection" error.
- An **admin / read-write** account can upload, delete, and purge the cache.
- Adding the Image widget as non-admin crew does **not** dead-end with a false "plugin not installed"
  prompt (the plugin-state API is admin-only, so KIP treats an unreadable state as "can't verify").

> Note: this secured, multi-role flow is a manual verification. The `run.sh`/compose here automate only
> the open (screenshot) server; a fully automated secured e2e with seeded accounts is a possible
> follow-up.

## Updating screenshots as the UI evolves

Rebuild `kip.tgz` (above) and `./run.sh` again, then re-capture the Image widget's Add panel, options
dialog, and the Settings → Media → Image Cache card into `src/assets/help-docs/img/`.
