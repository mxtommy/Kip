## Chartplotter Mode
Chartplotter Mode provides a persistent dual‑panel navigation layout: a continuously live Freeboard‑SK chart on one side and an actively switchable KIP dashboard on the other. Switching dashboards never unloads or blinks the chart, giving you an MFD‑style experience powered entirely by Signal K.

---

## When to Use It
Use Chartplotter Mode when you want uninterrupted situational awareness (chart + vessel motion + routing context) while cycling between specialized dashboards (navigation, engines, energy, racing, night watch, etc.). If you only need a chart on a few dashboards or have very constrained hardware, the standalone Freeboard‑SK widget may be sufficient.

---

## Key Capabilities
- Persistent Freeboard‑SK chart (no reload on dashboard change)
- Landscape side‑by‑side split; automatic vertical stacking in portrait / narrow screens
- Drag resize with commit‑on‑save (Cancel reverts instantly)
- Per‑dashboard forced collapse (treat some dashboards as full‑screen data pages)
- Remote dashboard switching compatible (chart forced collapse preserved remotely)
- Optional panel side selection (left or right)

---

## Enabling & Basic Setup
1. Open Actions → Settings → Display.
2. Expand **Chartplotter Mode** and toggle “Enable Freeboard‑SK dual‑panel Chartplotter Mode.”.
3. Choose the chart panel side (Left or Right).
4. Optionally, enable the per‑dashboard “Auto-collapse Freeboard-SK panel when displaying this dashboard” flag if you want that dashboard to hide the chart and use the full width.
5. Enter dashboard edit mode if you wish to resize the split (see Resizing section), then Save to persist or Cancel to discard.

Tip: Remove any existing Freeboard‑SK widget instances to avoid redundant chart rendering once mode is enabled.

---

## Orientation & Layout Behavior
| Environment | Layout |
|-------------|--------|
| Desktop and Phone / Wide Landscape | Horizontal split (chart + dashboard side‑by‑side) |
| Phone Portrait / Narrow | Automatic vertical stacking (top/bottom) |

The transition is automatic; no manual toggle is required. The per‑dashboard collapse still applies regardless of orientation.

---

## Resizing the Split
1. Enter dashboard edit mode on any dashboard (Actions → Unlock / Edit button).
2. Drag the split divider and release.
3. Press **Save** (check icon) to persist globally, or **Cancel** (X) to revert to the previous ratio.

Notes:
- Width changes are only committed on Save (prevents accidental layout shifts).
- Cancel always restores the original ratio before the edit session began.
- The persisted ratio applies across dashboards (unless a dashboard is collapsed).

---

## Per‑Dashboard Collapse
Each dashboard can force the chart panel closed to maximize data area. This is ideal for engine diagnostics, racing performance pages, or night watch minimalism. When you switch to a collapsed dashboard, the chart panel is hidden; switching back to a normal dashboard restores it instantly with its prior state and zoom.

Characteristics:
- Collapse is a per‑dashboard flag (not a remembered manual toggle).
- No chart reload occurs when re‑expanding—state (position, zoom, layers) persists.
- Remote control switches respect the same collapse logic.

---

## Selecting Chart Panel Side
Change side via Settings → Display → “Freeboard‑SK panel side”. This updates the split instantly. If a dashboard is collapsed, the side preference is applied the next time a non‑collapsed dashboard is shown.

---

## Chartplotter Mode vs Freeboard‑SK Widget
| Aspect | Chartplotter Mode | Freeboard‑SK Widget |
|--------|------------------|---------------------|
| Persistence across dashboard switches | Yes (never reloads) | Only on dashboards containing the widget |
| Resize workflow | Drag split + Save/Cancel | Standard widget resize | 
| Per‑dashboard full‑screen data toggle | Via collapse flag | N/A |
| Remote dashboard switching continuity | Yes | Yes |
| Memory footprint | Higher baseline (Freeboard-SK always resident) | Lower when dashboard lack the widget |
| Best for | Continuous nav + multi‑dashboard workflow (MFD) | Occasional chart reference |

---

## Remote Control Integration
When another KIP instance changes your active dashboard (Remote Control feature), the chartplotter mode and collapsed dashboard page settings are respected. No special configuration is required.

---

## Performance & Resource Notes
- The persistent chart consumes GPU/CPU continuously; on very low‑power hardware consider disabling Chartplotter Mode for purely data dashboards.
- Use per‑dashboard collapse for pages where chart context adds no value (reduces overdraw / repaint area temporarily).
- Avoid unnecessary high‑frequency (sub‑500 ms) widget sampling if chart responsiveness matters.
- Keep embedded iframes (Embed widget) minimal when running persistent chart + heavy datasets.

---

## Troubleshooting
| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| Chart disappears on one dashboard | Dashboard has collapse flag enabled | Edit dashboard settings and disable collapse if unintended |
| Split ratio didn’t save | Edit session canceled or not saved | Re‑enter edit mode, resize, press Save (check icon) |
| Chart briefly flashes when switching | Very first load after enabling mode | After initial load it remains persistent; subsequent switches should be flicker‑free |
| Freeboard‑SK widget shows duplicate chart | Legacy widget still on a dashboard | Remove the Freeboard‑SK widget when using Chartplotter Mode |
| Performance feels sluggish | High widget sampling or heavy embeds | Increase sample times, remove unused widgets, collapse non‑nav dashboards, investigate hardware resource consumption |

---

## FAQs
**Does the chart keep its zoom and layers when collapsed dashboards are shown?**  Yes. The panel is hidden, not destroyed.

**Can I temporarily hide the chart without changing dashboard flags?**  Use a dashboard that has the collapse flag enabled, or create a dedicated “Data Fullscreen” dashboard.

**Does resizing affect mobile portrait stacking?**  The stored ratio applies when returning to landscape; stacked orientation distributes available height automatically.

**Can I still add the Freeboard‑SK widget?**  You can, but it’s redundant and may waste resources. Prefer one approach.

**Will remote control commands interrupt a resize session?**  If remote switching occurs mid‑edit, the Drag resize session ends when you Save or Cancel; uncommitted changes do not apply until you explicitly save.

---

## Related Help
- Dashboards and Layout
- Remote Control
- Digital Switching and PUT
- Managing Configurations
