# KIP Plugin – Displays API

Base path for plugin routes: `/plugins/kip`

## Repo notes

- `kip-plugin/` contains the TypeScript source for the Signal K server plugin.
- The root-level `plugin/` folder (if present) is build output/packaging and is intentionally ignored by git.

## Endpoints

- GET `/plugins/kip/displays`
  - Returns: `[{ displayId: string, displayName: string | null }]`

- GET `/plugins/kip/displays/{displayId}`
  - Returns: the display's screens array from `self.displays.{displayId}.value.screens` (or `null`).

- PUT `/plugins/kip/displays/{displayId}`
  - Body: arbitrary JSON object to store under `self.displays.{displayId}` (or `null` to clear).
  - Returns: `{ state: "SUCCESS", statusCode: 200 }` on success.

- GET `/plugins/kip/displays/{displayId}/screenIndex`
  - Returns: `number | null` – the display's currently active screen index.

- PUT `/plugins/kip/displays/{displayId}/screenIndex`
  - Body: `{ "screenIdx": number | null }`
  - Sets: `self.displays.{displayId}.screenIndex`
  - Returns: `{ state: "SUCCESS", statusCode: 200 }` on success.

- GET `/plugins/kip/displays/{displayId}/activeScreen`
  - Returns: `number | null` – the requested screen index for a remote-controlled change.

- PUT `/plugins/kip/displays/{displayId}/activeScreen`
  - Body: `{ "screenIdx": number | null }`
  - Sets: `self.displays.{displayId}.activeScreen`
  - Returns: `{ state: "SUCCESS", statusCode: 200 }` on success.

## Examples

- List displays

```sh
curl -s http://localhost:3000/plugins/kip/displays | jq
```

- Read a display entry

```sh
curl -s http://localhost:3000/plugins/kip/displays/<displayId> | jq
```

- Set a display entry

```sh
curl -s -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Mast"}' \
  http://localhost:3000/plugins/kip/displays/<displayId>
```

- Get active screen

```sh
curl -s http://localhost:3000/plugins/kip/displays/<displayId>/activeScreen
```

- Get current screen index

```sh
curl -s http://localhost:3000/plugins/kip/displays/<displayId>/screenIndex
```

- Set active screen

```sh
curl -s -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"screenIdx":1}' \
  http://localhost:3000/plugins/kip/displays/<displayId>/activeScreen
```

- Set current screen index

```sh
curl -s -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"screenIdx":1}' \
  http://localhost:3000/plugins/kip/displays/<displayId>/screenIndex
```

Notes:
- Replace `<displayId>` with the KIP instance UUID under `self.displays`.
- If your Signal K server requires auth, include cookies or bearer token accordingly.

Terminology:
- `screenIndex` is the current active dashboard index for the display.
- `activeScreen` is a "request" path used to tell a remote-controlled display to switch.
