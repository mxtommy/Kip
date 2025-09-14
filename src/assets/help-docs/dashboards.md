## Managing Dashboards
Dashboards let you group widgets by task—navigation, engines, energy, weather, racing, night watch, and more. This guide covers creating, organizing, and editing dashboards, plus an overview of available widget types.

---

## 1. Dashboard Pages Panel
Open the Actions menu and select Settings.

Here you can:
- Add a new dashboard (+ button)
- Reorder dashboards (drag with touch or mouse)
- Rename and pick an icon (double tap or double click)
- Duplicate a dashboard (long press or long click → Duplicate)
- Delete a dashboard (long press or long click → Delete)

Choose icons that reflect each dashboard’s purpose (e.g. compass for navigation, droplet for tanks, bolt for power). Icons appear wherever dashboards are listed.

### Gesture / Action Summary
| Action         | Touch / Mobile         | Mouse / Desktop         |
|---------------|-----------------------|------------------------|
| Add dashboard | Tap (+)               | Click (+)              |
| Reorder       | Drag tile              | Drag tile              |
| Rename/Icon   | Double tap             | Double click           |
| Duplicate     | Long press → Duplicate | Long click → Duplicate |
| Delete        | Long press → Delete    | Long click → Delete    |

---

## 2. Editing Dashboard Layouts
1. Navigate to the dashboard you want to change (swipe or use dashboard selector).
2. Open the Actions menu.
3. Tap the Unlock/Lock button at the bottom to toggle edit mode.

In edit mode, widgets show dashed outlines.

### What You Can Do in Edit Mode
- Add a widget (long press empty space → Add Widget)
- Move a widget (drag)
- Resize a widget (drag edges/corners)
- Configure a widget (double tap/double click)
- Duplicate a widget (long press → Duplicate)
- Delete a widget (long press → Delete, then confirm)
- Save changes (Check button) or discard (X button) in the lower right

Tip: If you can’t add a widget, free up space by resizing or moving existing ones first.

---

## 3. Workflow: From Idea to Dashboard
1. Define the purpose (e.g. “Night Nav” = heading, COG, SOG, depth, wind, batteries, minimal brightness)
2. Create or duplicate a dashboard similar to what you want
3. Enter edit mode and add required widgets
4. Configure each widget’s data paths (keep sample times reasonable to reduce churn)
5. Arrange and size for readability at your viewing distance
6. Exit edit mode and test switching at real brightness/environment

---

## 4. Widget Gallery (Overview)
KIP widgets turn Signal K data into readable visuals and controls. Available widget types:

- **Numeric** – Displays numeric data in a clear and concise format, with options to show min/max values and a background minichart for trends.
- **Text** – Displays text data with customizable color formatting.
- **Date & Time** – Shows date and time with custom formatting and timezone correction.
- **Position** – Displays latitude and longitude for location tracking and navigation.
- **Static Label** – Add customizable labels to organize and clarify your dashboard layout.
- **Switch Panel** – Group of toggle switches, indicator lights, and press buttons for digital switching and operations.
- **Slider** – Range slider for adjusting values (e.g. lighting intensity).
- **Compact Linear** – Simple horizontal linear gauge with a large value label and modern look.
- **Linear** – Horizontal or vertical linear gauge with zone highlighting.
- **Radial** – Radial gauge with configurable dials and zone highlighting.
- **Compass** – Rotating compass gauge with multiple cardinal indicator options.
- **Level Gauge** – Dual-scale heel angle indicator for trim tuning and sea-state monitoring.
- **Pitch & Roll** – Horizon-style attitude indicator showing live pitch and roll degrees.
- **Classic Steel** – Traditional steel-look linear & radial gauges with range sizes and zone highlights.
- **Windsteer** – Combines wind, wind sectors, heading, COG, and waypoint info for wind steering.
- **Wind Trends** – Real-time True Wind trends with dual axes for direction and speed, live values, and averages.
- **Freeboard-SK** – Adds the Freeboard-SK chart plotter as a widget with automatic sign-in.
- **Autopilot Head** – Typical autopilot controls for compatible Signal K Autopilot devices.
- **Realtime Data Chart** – Visualizes data on a real-time chart with actuals, averages, and min/max.
- **Embed Webpage Viewer** – Embeds external web apps (Grafana, Node-RED, etc.) into your dashboard.
- **Racesteer** – Race steering display fusing polar performance data with live conditions for optimal tactics.
- **Racer - Start Line Insight** – Set and adjust start line ends, see distance, favored end, and line bias; integrates with Freeboard SK.
- **Racer - Start Timer** – Advanced racing countdown timer with OCS status and auto dashboard switching.
- **Countdown Timer** – Simple race start countdown timer with start, pause, sync, and reset options.

---

## 5. Performance & Layout Tips
- Favor clarity over cramming: leave space around high‑priority values
- Group related widgets (navigation, energy, engines, environment)
- Use consistent units per dashboard (e.g. all speeds in knots, all temps in °C or °F—don’t mix)
- For night dashboards, adjust brightness or use the all‑red theme in Settings → Options → Display
- Duplicate a working layout before making major changes (easy rollback)
- Keep sampling intervals modest (1000 ms+) unless fast reaction is essential
- Know your device’s hardware limits and adjust widget count per dashboard accordingly
- Avoid embedding too many external webpages—each adds load

---

## 6. Troubleshooting
| Issue                  | Possible Cause                        | Fix                                                                 |
|------------------------|---------------------------------------|---------------------------------------------------------------------|
| Data shows “—” or blank| Path missing/not configured/null value | Open widget config, verify Signal K path exists and updates. Use Data Inspector and Signal K Data Browser to view raw data from the server. |
| Wrong units            | Default convert unit used              | Edit widget config paths and set the desired target unit.            |
| Slow dashboard switching| Excessive data sampling/too many widgets| Increase sample times; remove unused widgets. Split widgets into separate dashboards. Optimize system resource usage. |
| Embedded page blank    | Cross‑origin blocked                   | See "Embed Page Viewer" help section.                               |

---

## 7. Next Steps
See also:
- Remote Control (switch dashboards on unattended displays)
- Night Mode (automatic theme + brightness)
- Contact / Issues (report widget feature ideas)

Refine incrementally—small improvements keep dashboards readable and reliable.
