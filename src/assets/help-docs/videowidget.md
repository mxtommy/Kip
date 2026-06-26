## Using the Video Widget

The Video widget plays live camera streams and recorded video right on your dashboard — useful for
situational awareness, docking, spotting hazards in the water, and keeping an eye on the boat.

## Adding a source

Open the widget's options and, under **Source**, paste a video URL. The widget plays anything your
browser can play directly:

- **Video files** — an `.mp4` or `.webm` URL.
- **HLS** — an `.m3u8` live stream.
- **MJPEG** — a motion-JPEG stream.
- **WebRTC (WHEP)** — a low-latency WebRTC endpoint.

**Stream type** is set to **Auto-detect** by default (it recognises HLS from the `.m3u8` ending and
otherwise treats the URL as a file). If auto-detect guesses wrong — common for MJPEG and WebRTC,
which have no standard file ending — pick the type explicitly.

> **RTSP and RTMP cameras** (what most IP cameras speak) can't be played by a web browser directly.
> Support for them — plus camera auto-discovery and pan/tilt/zoom — arrives with the companion
> **SK Video** Signal K plugin in a later update.

## Quality vs. latency

Live video trades **delay** against **smoothness**. Choose a preset under **Quality & Latency**:

- **Docking** — the lowest delay, for close-quarters manoeuvring.
- **Balanced** — a low delay with steady playback (recommended).
- **Best quality** — the smoothest picture, at the cost of more delay.

The widget recovers automatically if a live stream drops, retrying a few times before offering a
manual **Retry**. To save power and heat, live streams are paused while the dashboard is hidden.

## Snapshots

Hover the video (or tap it on a touch screen) to reveal the controls in the top-right: **Picture-in-
Picture**, **fullscreen**, and **snapshot**. The snapshot button captures the current frame; the
small arrow next to it chooses where it goes — **Download** or **Share**.

### Telemetry in snapshots

Snapshots can embed live boat data in the image's EXIF metadata — **GPS position**, plus heading,
speed, depth, wind and the time. This is handy for logging a hazard or a dock position. You control
this under **Snapshot** in the widget options:

- **Embed location (GPS)** — ⚠️ a shared or exported photo will reveal where the boat was. Turn this
  off if you don't want that.
- **Embed other telemetry** — time, speed, heading, depth, wind, and so on.

> **Note:** for security reasons a browser can only read pixels back from a video that is served from
> the same place as KIP (or with the right CORS headers). A snapshot of an arbitrary cross-origin
> URL will show a "snapshot not available" message instead. Snapshots work for same-origin sources,
> and will work for cameras served through the upcoming SK Video gateway.

## A note on Safari

**MJPEG** streams often show only a single frame in Safari and on iPhone/iPad. For those devices,
prefer an **HLS** or **WebRTC** source where possible — the widget will warn you when this applies.
