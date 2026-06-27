## Using the Image Widget

The Image widget displays a picture you upload to your Signal K server — for example a diagram showing where safety equipment is stowed, an electrical panel layout, or a boat plan. Images are stored on the server in a shared, boat-wide library, so every crew display can show the same picture.

## Uploading an image

1. Add an **Image** widget to a dashboard and open its options.
2. Click **Upload image** and choose a file. Supported formats are **JPG, PNG, WebP, GIF (including animated), HEIC/HEIF, and SVG**.
3. Each upload is limited to **10 MB**. Larger files are rejected.
4. You must be **logged in to the Signal K server** to upload, delete, or purge images. Viewing images only requires the normal KIP connection.

Uploaded pictures are added to the shared library. The thumbnail gallery in the widget options lets you reuse the same image across widgets and dashboards, or delete images you no longer need.

## Choosing how the image is displayed

- **Scaling**
  - **Fit** scales the whole image to fit inside the widget while preserving its aspect ratio. Any leftover space around the image shows the background.
  - **Fill** scales the image to cover the widget, cropping the edges as needed, while preserving aspect ratio.
- **Alt text** is a short description used by assistive technology and shown if the image cannot be displayed.
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

Cached variants can be cleared at any time from **Settings → Media → Image Cache**. The card shows the current on-disk cache size and a **Purge** button. Purging only removes the generated copies — your original uploads are kept, and variants are regenerated automatically the next time they are displayed.
