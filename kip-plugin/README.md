# KIP Plugin – Displays API

Base path for plugin routes: `/plugins/kip`

## Endpoints

- GET `/plugins/kip/displays`
  - Returns: `[{ displayId: string, displayName: string | null }]`

- GET `/plugins/kip/displays/{displayId}`
  - Returns the raw object stored at `self.displays.{displayId}` (or `null`).

- PUT `/plugins/kip/displays/{displayId}`
  - Body: arbitrary JSON object to store under `self.displays.{displayId}` (or `null` to clear).
  - Returns: `{ state: "SUCCESS", statusCode: 200 }` on success.

- GET `/plugins/kip/displays/{displayId}/activeScreen`
  - Returns: `number | null` – the active screen index.

- PUT `/plugins/kip/displays/{displayId}/activeScreen`
  - Body: `{ "screenIdx": number | null }`
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

- Set active screen

```sh
curl -s -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"screenIdx":1}' \
  http://localhost:3000/plugins/kip/displays/<displayId>/activeScreen
```

Notes:
- Replace `<displayId>` with the KIP instance UUID under `self.displays`.
- If your Signal K server requires auth, include cookies or bearer token accordingly.
