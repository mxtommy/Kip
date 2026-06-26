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

## IP cameras (RTSP/RTMP) via the gateway

Most IP cameras speak **RTSP** or **RTMP**, which a web browser can't play directly. Install the
companion **SK Video** Signal K plugin and KIP will stream those cameras through it — the browser
only ever talks to your Signal K server, so there are no cross-origin or "local network" warnings.

Under **Source**, choose **Camera**:

- **Pick a saved camera** from the list, or
- **Scan network** to discover ONVIF cameras automatically, then tap one to fill in its details, or
- **Add a camera** by hand: give it a name, pick the stream type (usually RTSP), and enter the
  address, port and path. If the camera needs a login, add the **username and password** — these are
  stored on the Signal K server only and are never synced to your devices.

Pick **Delivery**: *Standard (HLS)* works everywhere; *Low latency (WebRTC)* is best for docking.

## Uploaded videos

With the **SK Video** plugin installed you can also store video files on the boat's Signal K server
and play them on any device. Under **Source**, choose **Uploaded**, then **Upload a video** (MP4,
WebM or MOV). Uploaded clips appear in the list to pick from, play back with seeking, and can be
deleted with the trash button.

### Pan, tilt & zoom

If the camera supports **PTZ** (pan/tilt/zoom over ONVIF), a control pad appears over the video.
Press and hold an arrow to move, hold the **+ / −** buttons to zoom, and use the **bookmarks** button
to recall a saved preset. The camera stops as soon as you let go.

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
> URL will show a "snapshot not available" message instead. Snapshots work for same-origin sources
> and for cameras served through the SK Video gateway.

## A note on Safari

**MJPEG** streams often show only a single frame in Safari and on iPhone/iPad. For those devices,
prefer an **HLS** or **WebRTC** source where possible — the widget will warn you when this applies.
