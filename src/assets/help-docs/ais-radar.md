## AIS Radar Widget

> **WARNING - FOR SITUATIONAL AWARENESS ONLY**  
> AIS widget data (including collision risk and target information) can be delayed, incomplete, incorrect, or unavailable.  
> This feature provides **no safety guarantee** and must be used **at your own risk**.  
> It is **not** a replacement for proper seamanship, safe navigation practices, collision regulations, visual/radar watchkeeping, or prudent decision making.

The AIS Radar widget shows nearby AIS targets around your own-ship position using range rings, target icons, motion vectors, and target details.

This page explains:
- Widget buttons and what they do
- Widget options and filters
- Target icon colors, styles and state behaviors
- Full target icon catalog

## Data Requirements

> AIS data must be available in the Signal K server for the widget to function correctly. This usually means using compatible AIS hardware receiver or connecting to a Virtual AIS service over the internet with a Server Connection of type WebSocket.

If the KIP Connection option does not include `Subscribe to remote source message such as AIS and DSC targets.`, the widget warns that AIS data is disabled and asks you to enable remote source subscription in Settings / Options.

The Derived Data plugin must be installed, enabled and it's Traffic section options must be configured with attention to provide collision risk information.

## Buttons And Actions

### On-widget buttons

| Button | Location | What it does |
|---|---|---|
| View mode toggle | Top-right | Switches between Course Up and North Up view orientation. |
| Range + | Right side | Zooms in by selecting a smaller range ring index. |
| Range - | Right side | Zooms out by selecting a larger range ring index. |
| Filter list | Top-left | Opens target filtering menu (category and vessel-type filters). |
| Collision shortcut | Left side under filter | Toggles Show only collision-risk targets mode when risk data is available. |

> Collision-risk shortcut button visibility depends on incoming closest-approach data. If no target provides collisionRiskRating, the collision quick-filter button is not shown.

### Target interaction

| Action | Result |
|---|---|
| Tap or click one visible target | Opens target detail dialog directly. |
| Tap or click where multiple targets overlap | Opens a target picker menu so you can select which target to inspect. |
| Tap or click background | Clears selection and closes target menu. |

### Target detail dialog

The dialog includes information based on target type such as: COG, SOG, HDG, ROT, CPA/TCPA, destination, IDs, position, off-position and freshness

## How To Read Radar Targets

---

Most AIS users will want to understand this first: each target combines a base icon and extra visual cues.

1. **Icon shape** tells you what kind of target it is.
2. **State look** tells you if data is fresh and reliable.
3. **Risk glow** tells you if attention is needed now.
4. **Motion vector** tells you where the target is going.

### Target states explanation

Supported statuses:
- Confirmed
- Unconfirmed
- Lost
- Remove

What that means on screen:
- **Confirmed**: normal target look.
- **Unconfirmed**: same icon shape, but looks faded/lower confidence.
- **Lost**: same icon shape, also shown as faded/lower confidence.
- **Remove**: target disappears from the radar.

Important behavior note:
- **Lost** uses the same visual styling family as **unconfirmed**.

### State cue rules (opacity)

- **Unconfirmed or lost**: icon appears faded (have less opacity than confirmed targets).
- **Confirmed**: icon appears solid.

### Risk cue rules (glow)

Collision risk glow appears only on **moving, confirmed** targets:
- **Red glow**: higher risk
- **Yellow glow**: lower risk
- **No glow**: no current risk emphasis

### Anchored or moored nav state (transparent / no fill color)

Anchored/moored targets are shown as **stationary vessel targets**.

Important:
- There is **no special anchor badge/icon** added on top of the vessel symbol.

What to look for:
- The vessel icon is still present (normal vessel type icon).
- When a vessel is **confirmed** and reports **anchored/moored** state, the icon fill color is rendered **transparent** (the icon only has an outline).
- It usually has **no motion vector**.
- It typically has **no collision glow** unless movement/risk data says otherwise.

Important limitation:
- Anchored/moored is a **reported nav state**. Some vessels do not report it consistently, some never do.
- A vessel can be operationally moored/anchored but still appear as a normal confirmed vessel if that state is not transmitted.
- Anchored/moored nav state is commonly reported by commercial vessels (cargo, tanker, passenger ship), but it is not typical for other types of vessels.


How to interpret in practice:
- If nav state is missing, use movement clues: a persistent no/very short vector and stable position usually suggest moored/anchored behavior.

### Own-ship vector rules

Own ship shows an orange dashed vector when own COG and SOG are available and own-ship icon display is enabled.

## Widget Options

---

After you understand the visual cues above, use these options to tune what you see.

The widget is configured in the Options dialog under the Display and Filter tabs.

### Display and range options

| Option | Values | Effect |
|---|---|---|
| View Mode | North Up, Course Up | Controls map orientation and target rotation behavior. |
| Fully Visible Rings Range | 1, 3, 6, 12, 24, 48 miles | Sets active range index for ring scale. |
| Show own ship icon | On or Off | Shows or hides the own-ship center icon. |

### Vector and target visibility options

| Option | Values | Effect |
|---|---|---|
| Plot target COG vector | On or Off | Draws target motion vectors for moving vessel-like targets. |
| COG plot length (minutes) | Numeric | Sets projection length for motion vectors (of Plot target COG vector). |
| Show unconfirmed targets | On or Off | Includes or hides unconfirmed targets. |
| Show lost targets | On or Off | Includes or hides lost targets. |

### Filter tab options

| Filter | Effect |
|---|---|
| Anchored/Moored | Hides stationary vessel-like targets (anchored or moored). |
| All AtoN | Hides all aids-to-navigation targets. |
| All but SAR | Hides every target except SAR targets. |
| All Vessels | Hides all vessel-like targets. |
| Vessel Type list | Hides selected vessel icon categories only. |

### Runtime quick filter note

The collision quick-filter button toggles a noCollisionRisk runtime filter in the widget. This option is intentionally runtime-only in the widget UI and is not exposed as a checkbox in the Filter tab.

## Full Target Icon Catalog

---

### Icon Selection Rules

Icon selection uses target type and AIS metadata:
- Vessel and SAR: selected from AIS ship type range mapping
- AtoN: selected from AtoN type id mapping (cardinal, lateral, special, danger/safe, other)
- Basestation: dedicated basestation icon
- Distress beacons: MMSI prefixes map to SART, MOB, EPIRB beacon icons

Distress beacon MMSI prefixes:
- 970 -> SART icon
- 972 -> MOB icon
- 974 -> EPIRB icon

### Vessel icons


| Key | Preview | Typical use |
|---|---|---|
| vessel/fishing | ![vessel fishing](assets/svg/vessel/fishing.svg) | AIS ship type 30 |
| vessel/diving | ![vessel diving](assets/svg/vessel/diving-ops.svg) | AIS ship type 34 |
| vessel/military | ![vessel military](assets/svg/vessel/military-ops.svg) | AIS ship type 35 |
| vessel/sailing | ![vessel sailing](assets/svg/vessel/sailing.svg) | AIS ship type 36 |
| vessel/pleasurecraft | ![vessel pleasurecraft](assets/svg/vessel/pleasurecraft.svg) | AIS ship type 37 |
| vessel/highspeed | ![vessel highspeed](assets/svg/vessel/highspeed.svg) | AIS ship type 20-29, 40-49 |
| vessel/pilot | ![vessel pilot](assets/svg/vessel/pilot.svg) | AIS ship type 50 |
| vessel/sar | ![vessel sar](assets/svg/vessel/sar.svg) | SAR (Search And Rescue) target type and AIS ship type 51 |
| vessel/tug | ![vessel tug](assets/svg/vessel/tug.svg) | AIS ship type 31-33, 52-54, 58-59 |
| vessel/law | ![vessel law](assets/svg/vessel/law-enforcement.svg) | AIS ship type 55 |
| vessel/passenger | ![vessel passenger](assets/svg/vessel/passenger.svg) | AIS ship type 60-69 |
| vessel/cargo | ![vessel cargo](assets/svg/vessel/cargo.svg) | AIS ship type 70-79 |
| vessel/tanker | ![vessel tanker](assets/svg/vessel/tanker.svg) | AIS ship type 80-89 |
| vessel/other | ![vessel other](assets/svg/vessel/other.svg) | Generic fallback and multiple reserved ship-type ranges |
| vessel/unknown | ![vessel unknown](assets/svg/vessel/unknown.svg) | Unknown vessel fallback by type |
| vessel/spare | ![vessel spare](assets/svg/vessel/other.svg) | Spare category in filter set (shares other.svg) |

### Aid to Navigation (AtoN) icons

#### Cardinal

| Key | Preview | Description |
|---|---|---|
| aton/north-beacon | ![aton north beacon](assets/svg/AtoN/cardinal/north_beacon.svg) | Cardinal north beacon target. |
| aton/north-mark | ![aton north mark](assets/svg/AtoN/cardinal/north_mark.svg) | Cardinal north mark target. |
| aton/east-beacon | ![aton east beacon](assets/svg/AtoN/cardinal/east_beacon.svg) | Cardinal east beacon target. |
| aton/east-mark | ![aton east mark](assets/svg/AtoN/cardinal/east_mark.svg) | Cardinal east mark target. |
| aton/south-beacon | ![aton south beacon](assets/svg/AtoN/cardinal/south_beacon.svg) | Cardinal south beacon target. |
| aton/south-mark | ![aton south mark](assets/svg/AtoN/cardinal/south_mark.svg) | Cardinal south mark target. |
| aton/west-beacon | ![aton west beacon](assets/svg/AtoN/cardinal/west_beacon.svg) | Cardinal west beacon target. |
| aton/west-mark | ![aton west mark](assets/svg/AtoN/cardinal/west_mark.svg) | Cardinal west mark target. |

#### Lateral

| Key | Preview | Description |
|---|---|---|
| aton/port-beacon | ![aton port beacon](assets/svg/AtoN/lateral/port_beacon.svg) | Port-hand lateral beacon target. |
| aton/port-mark | ![aton port mark](assets/svg/AtoN/lateral/port_mark.svg) | Port-hand lateral mark target. |
| aton/starboard-beacon | ![aton starboard beacon](assets/svg/AtoN/lateral/starboard_beacon.svg) | Starboard-hand lateral beacon target. |
| aton/starboard-mark | ![aton starboard mark](assets/svg/AtoN/lateral/starboard_mark.svg) | Starboard-hand lateral mark target. |
| aton/port-preferred-beacon | ![aton port preferred beacon](assets/svg/AtoN/lateral/port_prefered_beacon.svg) | Preferred-channel-to-port beacon target. |
| aton/port-preferred-mark | ![aton port preferred mark](assets/svg/AtoN/lateral/port_prefered_mark.svg) | Preferred-channel-to-port mark target. |
| aton/starboard-preferred-beacon | ![aton starboard preferred beacon](assets/svg/AtoN/lateral/starboard_prefered_beacon.svg) | Preferred-channel-to-starboard beacon target. |
| aton/starboard-preferred-mark | ![aton starboard preferred mark](assets/svg/AtoN/lateral/starboard_prefered_mark.svg) | Preferred-channel-to-starboard mark target. |

#### Special and danger/safe

| Key | Preview | Description |
|---|---|---|
| aton/special-beacon | ![aton special beacon](assets/svg/AtoN/special/special_beacon.svg) | Special-purpose beacon target. |
| aton/special-mark | ![aton special mark](assets/svg/AtoN/special/special_mark.svg) | Special-purpose mark target. |
| aton/isolateddanger-beacon | ![aton isolated danger beacon](assets/svg/AtoN/dangerSafe/isolateddanger_beacon.svg) | Isolated danger beacon target. |
| aton/isolateddanger-mark | ![aton isolated danger mark](assets/svg/AtoN/dangerSafe/isolateddanger_mark.svg) | Isolated danger mark target. |
| aton/safewater-beacon | ![aton safewater beacon](assets/svg/AtoN/dangerSafe/safewater_beacon_.svg) | Safe-water beacon target. |
| aton/safewater-mark | ![aton safewater mark](assets/svg/AtoN/dangerSafe/safewater_mark.svg) | Safe-water mark target. |

#### Other and infrastructure

| Key | Preview | Description |
|---|---|---|
| aton/other | ![aton other](assets/svg/AtoN/other/aton.svg) | Generic AtoN fallback target. |
| aton/basestation | ![aton basestation](assets/svg/AtoN/other/basestation.svg) | Shore basestation target symbol. |
| aton/unknown | ![aton unknown](assets/svg/AtoN/other/unknown.svg) | Unknown AtoN fallback target. |

### Distress beacon icons

| Key | Preview | MMSI prefix | Description |
|---|---|---|---|
| beacon/sart | ![beacon sart](assets/svg/sar-distress-device/sart-eprib-mob.svg) | 970 | Search and rescue transponder beacon target. |
| beacon/mob | ![beacon mob](assets/svg/sar-distress-device/sart-eprib-mob.svg) | 972 | Man overboard beacon target. |
| beacon/epirb | ![beacon epirb](assets/svg/sar-distress-device/sart-eprib-mob.svg) | 974 | Emergency position-indicating beacon target. |

### Own-ship icon

The center own-ship icon uses its own dedicated asset and is not part of remote target classification.

| Key | Preview |
|---|---|
| vessel/self | ![vessel self](assets/svg/vessel/self.svg) |

## See Also

- [Managing Dashboards](#/help/dashboards.md)
- [Data Inspector](#/help/datainspector.md)
- [Chartplotter Mode](#/help/chartplotter.md)
