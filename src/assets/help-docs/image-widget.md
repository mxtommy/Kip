## Using the Image Widget

The Image widget displays a picture you upload to your Signal K server — for example a diagram showing where safety equipment is stowed, an electrical panel layout, or a boat plan. Images are stored on the server in a shared, boat-wide library, so every crew display can show the same picture.

## Requirements

The images are stored and served by the **SK Image** Signal K plugin (version 1.5.0 or later), a separate server-side plugin — not part of KIP itself. KIP lists it as a recommended plugin, so the Signal K App Store offers to install it when you install or update KIP. You can also install it at any time from your server's **App Store** by searching for "SK Image".

The plugin needs **Node.js 22.13 or newer** on the Signal K server. On an older Node version the plugin will not load and the widget will report that the image library is unavailable — update the server's Node.js, or run the plugin on a server that meets the requirement.

Viewing images only needs the normal KIP connection. Uploading, deleting, or purging images requires a Signal K account with write access.

## Uploading an image

<img src="assets/help-docs/img/image-widget-add.png" alt="The Image widget in the Add Widget panel" title="Add the Image widget" width="100%">

1. Add an **Image** widget to a dashboard and open its options.
2. Click **Upload image** and choose a file. Supported formats are **JPG, PNG, WebP, GIF (including animated), HEIC/HEIF, and SVG**.
3. Each upload is limited to **10 MB**. Larger files are rejected.
4. Uploading, deleting, and purging need a Signal K account with **write access** (read-write or admin). A read-only account can still view images, but not change them.

Uploaded pictures are added to the shared library. The thumbnail gallery in the widget options lets you reuse the same image across widgets and dashboards, or delete images you no longer need.

## Choosing how the image is displayed

<img src="assets/help-docs/img/image-widget-options.png" alt="The Image widget options dialog" title="Image widget options" width="100%">

- **Scaling**
  - **Fit** scales the whole image to fit inside the widget while preserving its aspect ratio. Any leftover space around the image shows the background.
  - **Fill** scales the image to cover the widget, cropping the edges as needed, while preserving aspect ratio.
- **Description** is read aloud by screen readers and shown if the image cannot be displayed. Add one so the widget is usable without sight of the picture.
- **Background** can be a solid color or **transparent** (the dashboard shows through the area around a "Fit" image).

## How images are stored and served

To keep displays fast and the server responsive, the plugin does the following:

- **Originals are stored once.** Resized copies (variants) are created **on demand** the first time a widget of a given size requests the image, then cached on disk.
- **Raster images are re-encoded to WebP** at a size matched to the widget, so a small widget never downloads a full-resolution photo.
- **SVG drawings are kept as vector** and stay crisp at any size.
- **Animated GIFs** are converted to animated WebP and keep animating.
- Image resizing runs in background worker threads so the server stays responsive.

## Security

Uploaded content is treated as untrusted and is checked before it is stored:

- Files are validated by their actual content, not their file name.
- Raster images are re-encoded, which neutralizes files that try to hide other content inside them.
- SVG files are sanitized to remove scripts and other active content, and are only ever shown inside an image element where scripts do not run.
- Restrictive response headers prevent the browser from treating images as anything other than images.

## Managing the image cache

<img src="assets/help-docs/img/image-widget-cache.png" alt="The Image Cache card on the Media settings tab" title="Settings → Media → Image Cache" width="100%">

Cached copies can be cleared at any time from **Settings → Media → Image Cache**. The card shows the current cache size and a **Clear cache** button. Clearing only removes the smaller, generated copies — your original uploads are kept, and the copies are recreated automatically the next time they are displayed.
