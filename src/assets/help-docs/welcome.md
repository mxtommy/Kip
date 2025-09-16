## Touch, Mouse, and Keyboard Navigation
KIP supports multiple input modes for seamless navigation across devices.

| Actions                    | Touch         | Mouse                        | Keyboard Shortcuts                                 |
|----------------------------|--------------|------------------------------|----------------------------------------------------|
| Open Actions sidenav          | Swipe left    | Click, drag left, and release| <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>←</kbd> (Left Arrow) |
| Open Notification sidenav     | Swipe right   | Click, drag right, and release| <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>→</kbd> (Right Arrow)  |
| Cycle through dashboards   | Swipe up/down | Click, drag up/down, and release| <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> (Up/Down Arrow) |
| Toggle Fullscreen          | N/A           | N/A                          | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>F</kbd>  |
| Toggle Night mode          | N/A           | N/A                          | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>N</kbd>  |
| Toggle dashboard edit mode | N/A           | N/A                          | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd>  |

_Note that the words Touch and Tap are synonymous with mouse click._
<br/>

## General Layout
<img src="../../assets/help-docs/img/general-layout.png" alt="Sidebar Menus" title="Sidebar Menus" width="100%">

1. Actions menu
2. *Fullscreen toggle button
3. **Night Mode toggle button
4. Settings button
5. Select dashboard buttons
6. Unlock dashboard edit mode
7. Notifications menu
8. Notification message
9. Silence notification
10. Resolve notification
11. Mute audio toggle button

*Only visible if mode is supported

**Only if visible if automatic day and night is not enabled. See <Home / Settings / Display>.

## Loading KIP on Phones, Tablets, Raspberry Pi, and Computers
Simply navigate to `http://<Signal K Server URL>:<port>/@mxtommy/kip/` to load KIP and enjoy its features remotely on any device.

## Mobile App
Run KIP in full screen, without browser controls, just like a regular mobile app. This feature is supported on most mobile operating systems. Each browser has its own way of handling Progressive Web App (PWA) installations.

**iOS**
1. Press the "Share" button.
2. Select "Add to Home Screen" from the action popup list.
3. Tap "Add" in the top right corner to finish installation.
KIP is now installed and available on your home screen.

**Android**
1. Press the "three dot" icon in the upper right to open the menu.
2. Select "Add to Home screen."
3. Press the "Add" button in the popup.
KIP is now installed and available on your home screen.

## Fullscreen
You can toggle fullscreen mode on and off, and disable the screen saver and computer sleep mode (if supported by the device/browser), by clicking the small Expand/Reduce button in the upper left corner of the Actions menu or using the keyboard hotkey. This button is not available on mobile devices.

## Night Mode
Save your night vision by automatically switching KIP to day or night mode based on sunrise and sunset hours (the Signal K Derived Data plugin is required for automatic switching). This feature can be enabled in the **Settings > Display** page. You can also manually set the mode by clicking the small Moon/Sun button in the upper right corner of the Actions menu. Note that if automatic switching is enabled, brightness will reset to the Signal K mode value.

## Chartplotter Mode
Keep a live Freeboard‑SK chart visible while switching dashboards for an MFD‑style workflow. The chart persists (no reload or flicker), you can choose its side, collapse it per‑dashboard for full data pages, and drag resize the split. Layout auto‑stacks in portrait / narrow screens. See the dedicated Chartplotter Mode help page for setup, performance tips, and troubleshooting.

## Multiple User Profiles and Configuration Sharing
KIP supports multiple user profiles, allowing different roles on board—such as captain, skipper, tactician, navigator, or engineer—to tailor the interface to their needs. Profiles can also be used to tie specific configuration arrangements to use cases or device form factors. See the Login & Configurations help sections for mode details.

## Remote Control Other KIP Displays
Control which dashboard is shown on another KIP instance (for example: a mast display, a TV or pilot‑house screen that is hard to reach, or a device with no local input hardware).

### Typical Use Cases
- Mast display: change dashboards from the cockpit without going forward.
- Salon / TV screen: rotate between navigation and status dashboards easily.
- Headless / no input device: select dashboards when there is no keyboard/mouse or touch is disabled.

### Requirements
- Both devices must be connected to the same Signal K server.
- You must be logged in (authenticated) on both devices (Connectivity tab → Login to Server enabled).
- The target device must explicitly allow remote control (Display tab → Remote Control option group).

### Good Naming Practice
If multiple devices log in with the same Signal K user to share configuration, they inevitably share the same Instance Name. Whilst being confusing, it will still work. To fix this, you must use different Signal K users and set a descriptive name on each configuration (e.g. Mast Display, Helm Port, Nav Station) so you can identify them quickly.

### Setup
1. On the device you want to control (Target KIP)
  - Open: Options → Display → Remote Control.
  - Enable: Allow this KIP dashboard to be managed remotely.
  - Set: Instance Name (this is what will appear in the controller list).
2. On the controlling device
  - Open: Actions menu → Settings → Remote Control.
  - Select the target device by its Instance Name.
  - Click / tap a dashboard tile to activate it on the target device.

### Using Remote Control
- The currently active dashboard on the target device is highlighted.
- Switching is usually instantaneous; brief delays can indicate network latency.
- You can leave the Remote Control panel open to “page” through dashboards live.

### Troubleshooting
| Problem | What to Check |
|---------|----------------|
| Target device not listed | Is remote control enabled there? Is Instance Name set? Both on same Signal K server? |
| No highlight / not switching | Confirm target device stays online (no sleep / browser closed). Refresh controller panel. |
| Wrong device switched | Two devices share same Instance Name—rename one. |
| Works, then stops | Network drop or Signal K reconnect in progress—wait a few seconds or reload. |

### Tips
- Keep Instance Names short but meaningful (e.g. Mast, Helm, NavTV).
- For unattended displays, enable the browser’s keep‑awake / no‑sleep features if supported.
- Combine with Night Mode + per‑profile layouts for role‑specific remote switching.
- Use different Signal K users if you want fully isolated configurations.

### Privacy / Safety Note
Anyone with access to a logged‑in controlling KIP instance can switch dashboards on enabled targets. Only enable remote management on displays where that is acceptable.
