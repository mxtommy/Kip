## Raspberry Pi Kiosk Mode (Chromium)

This guide launches Chromium in kiosk mode to display KIP at:
http://<sk_server_IP>:3000/@mxtommy/kip/#/page/0

It supports Raspberry Pi OS Bullseye (X11/LXDE) and Bookworm (Wayland).

## What is “kiosk mode”?
Kiosk mode runs a single application full-screen and suppresses most desktop UI. In this guide, Chromium loads KIP and stays on screen like a dedicated instrument display.

- What it does:
  - Launches Chromium full-screen without toolbars (“chrome”).
  - Autostarts after login; optional auto-restart via systemd.
  - Disables screen blanking; can hide the mouse cursor.
- What it does not do:
  - It is not a full OS lockdown or content filter.
- Exit/maintenance:
  - Desktop autostart: press Alt+F4 to close, or switch to a TTY (Ctrl+Alt+F2) and run: pkill chromium-browser || pkill chromium.
  - systemd user service: systemctl --user stop kiosk.service (disable with systemctl --user disable kiosk.service).


## 1) Prerequisites

- Raspberry Pi OS with Desktop, user: `pi` (or adjust paths).
- Chromium installed:
  ```bash
  sudo apt update
  sudo apt install -y chromium-browser || sudo apt install -y chromium
  ```
- Optional (hide mouse cursor):
  ```bash
  sudo apt install -y unclutter
  ```
- Enable Desktop autologin:
  ```bash
  sudo raspi-config
  ```
  System Options → Boot / Auto Login → Desktop Autologin

- Disable screen blanking
  - Wayland (Bookworm): raspi-config → Display Options → Screen Blanking → No
  - X11 (Bullseye): we also disable via `xset` in the script below.

## 2) Create the kiosk launcher script

```bash
sudo nano /home/pi/kiosk.sh
```

Paste:

```bash
#!/usr/bin/env bash
set -euo pipefail

# URL for KIP (adjust as needed)
URL="${URL:-http://<sk_server_IP>:3000/@mxtommy/kip/#/page/0}"

# Pick Chromium binary
BROWSER="$(command -v chromium-browser || true)"
if [[ -z "${BROWSER}" ]]; then
  BROWSER="$(command -v chromium || true)"
fi
if [[ -z "${BROWSER}" ]]; then
  echo "Chromium not installed. Try: sudo apt update && sudo apt install -y chromium-browser || sudo apt install -y chromium"
  exit 1
fi

# Hide mouse cursor if unclutter is available
if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0 -root &
fi

# Disable screen blanking on X11 (LXDE). On Wayland, use raspi-config instead.
if [[ "${XDG_SESSION_TYPE:-}" == "x11" ]]; then
  xset s off -dpms
  xset s noblank
fi

# Optional: wait for network/host (best-effort, up to ~2 minutes)
host="$(echo "$URL" | sed -E 's#^[a-z]+://([^:/]+).*$#\1#')"
if command -v ping >/dev/null 2>&1; then
  for i in {1..60}; do
    ping -c1 -W1 "$host" >/dev/null 2>&1 && break || sleep 2
  done
fi

exec "$BROWSER" \
  --kiosk \
  --start-fullscreen \
  --no-first-run \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-features=TranslateUI \
  --enable-features=OverlayScrollbar \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --app="$URL"
```

Optionally, you can also add the following `exec "BROWSER" \` flags:

Force Chromium to keep all threads active and not optimyze resource usage
```bash
--disable-background-timer-throttling \
--disable-renderer-backgrounding \
--disable-backgrounding-occluded-windows
```

Reduce memory consumption (Pi Zero)
```bash
--disable-gpu \
--single-process \
--js-flags="--max-old-space-size=512"
```

Save, then:

```bash
sudo chmod +x /home/pi/kiosk.sh
```

Tip: You can override the URL without editing the script using:
```
URL="http://signalk.local:3000/@mxtommy/kip/#/page/0" /home/pi/kiosk.sh
```

## 3A) Autostart via Desktop (.desktop) – simplest

Create an autostart entry:

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/kiosk.desktop
```

Paste:

```ini
[Desktop Entry]
Type=Application
Name=KIP Kiosk
Exec=/home/pi/kiosk.sh
Terminal=false
X-GNOME-Autostart-enabled=true
```

This launches after the desktop session starts.

## 3B) Autostart via systemd (user) – robust, auto‑restart

Recommended if you want Chromium to restart on crash.

```bash
mkdir -p ~/.config/systemd/user
nano ~/.config/systemd/user/kiosk.service
```

Paste:

```ini
[Unit]
Description=KIP Chromium Kiosk
After=graphical-session.target network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=URL=http://<sk_server_IP>:3000/@mxtommy/kip/#/page/0
ExecStart=/home/pi/kiosk.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical-session.target
```

Enable:

```bash
systemctl --user daemon-reload
systemctl --user enable --now kiosk.service
```

Logs (for debugging):
```bash
journalctl --user -u kiosk.service -f
```

Note: This runs after user login to the desktop. Ensure Desktop Autologin is enabled (Step 1).

## 4) Reboot and verify

```bash
sudo reboot
```

Chromium should open full-screen at:
http://<sk_server_IP>:3000/@mxtommy/kip/#/page/0

## Troubleshooting

- Blank screen on Bookworm: confirm Screen Blanking is disabled in raspi-config (Wayland ignores xset).
- Chromium not found: install package `chromium-browser` or `chromium` (varies by OS version).
- Wrong URL: KIP is served under /@mxtommy/kip/. Ensure the full path is used.
- Certificates: prefer HTTP or trusted TLS. Avoid `--ignore-certificate-errors` in kiosk.
- systemd service not starting: check `journalctl --user -u kiosk.service -f
