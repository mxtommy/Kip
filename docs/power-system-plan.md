# Power System Widgets Plan

This document captures the agreed plan for implementing the BMS widget, Solar widget, and Power System Map widget. It preserves all decisions and technical details so each step can be executed later without losing context.

## Step 1: BMS Widget

### Goal
Build a Host2 widget that discovers batteries, allows user-defined banks, and displays bank and per-battery metrics in a D3 SVG layout with animated flow direction cues.

### Core behavior
- Discovery is hybrid: auto-discover batteries under `self.electrical.batteries.*`, then allow user selection.
- Banks are user-defined groups of batteries.
- Aggregation uses simple sums where applicable.
- Visual flow direction is shown with animated arrows or dots.

### Signal K path coverage
- Roots: `self.electrical`, `self.electrical.batteries`, `self.electrical.batteries.<id>`
- Identity and metadata:
  - `self.electrical.batteries.<id>.name`
  - `self.electrical.batteries.<id>.location`
  - `self.electrical.batteries.<id>.dateInstalled` (RFC3339)
  - `self.electrical.batteries.<id>.manufacturer.name`
  - `self.electrical.batteries.<id>.manufacturer.model`
  - `self.electrical.batteries.<id>.manufacturer.URL`
  - `self.electrical.batteries.<id>.associatedBus`
  - `self.electrical.batteries.<id>.chemistry`
- Core electrical:
  - `self.electrical.batteries.<id>.voltage`
  - `self.electrical.batteries.<id>.voltage.ripple`
  - `self.electrical.batteries.<id>.current` (flow out +, in -)
  - `self.electrical.batteries.<id>.temperature`
- Capacity and state:
  - `self.electrical.batteries.<id>.capacity.nominal`
  - `self.electrical.batteries.<id>.capacity.actual`
  - `self.electrical.batteries.<id>.capacity.remaining`
  - `self.electrical.batteries.<id>.capacity.dischargeLimit`
  - `self.electrical.batteries.<id>.capacity.stateOfCharge`
  - `self.electrical.batteries.<id>.capacity.stateOfHealth`
  - `self.electrical.batteries.<id>.capacity.dischargeSinceFull`
  - `self.electrical.batteries.<id>.capacity.timeRemaining`
- Lifecycle totals:
  - `self.electrical.batteries.<id>.lifetimeDischarge`
  - `self.electrical.batteries.<id>.lifetimeRecharge`

### UI and visuals
- Primary view: bank summary with expandable per-battery details.
- Animated flow direction for current and power.
- Theme-aware coloring using existing theme roles.

### Config UI
- Custom bank setup panel under widget-config for selecting batteries and defining banks.


## Step 2: Solar Widget

### Goal
Build a Solar Charge Controller widget that mirrors the BMS structure and supports grouping of chargers into banks.

### Solar metrics to support
- Charger current (Amps flow out)
- Panel current (cumulative Amps flow in)
- Load port name
- Load port current (Amps out)

### Signal K path coverage
- Roots: `self.electrical.solar`, `self.electrical.solar.<id>`
- Identity and metadata:
  - `self.electrical.solar.<id>.name`
  - `self.electrical.solar.<id>.location`
  - `self.electrical.solar.<id>.dateInstalled` (RFC3339)
  - `self.electrical.solar.<id>.manufacturer.name`
  - `self.electrical.solar.<id>.manufacturer.model`
  - `self.electrical.solar.<id>.manufacturer.URL`
  - `self.electrical.solar.<id>.associatedBus`
- Electrical and control:
  - `self.electrical.solar.<id>.voltage`
  - `self.electrical.solar.<id>.voltage.ripple`
  - `self.electrical.solar.<id>.current`
  - `self.electrical.solar.<id>.temperature`
  - `self.electrical.solar.<id>.chargingAlgorithm`
  - `self.electrical.solar.<id>.chargerRole`
  - `self.electrical.solar.<id>.chargingMode`
  - `self.electrical.solar.<id>.setpointVoltage`
  - `self.electrical.solar.<id>.setpointCurrent`
  - `self.electrical.solar.<id>.controllerMode`
- Panel and load ports:
  - `self.electrical.solar.<id>.panelVoltage`
  - `self.electrical.solar.<id>.panelCurrent`
  - `self.electrical.solar.<id>.panelTemperature`
  - `self.electrical.solar.<id>.load`
  - `self.electrical.solar.<id>.loadCurrent`

### UI and visuals
- Similar bank view and per-device details as BMS.
- Animated flow direction for charge in/out.

### Config UI
- Reuse or parameterize the bank setup panel to support solar controllers.


## Step 3: Power System Map Widget

### Goal
Build a full power system map with card layout, connectors, and animated flow dots. Use BMS and Solar widgets as embedded card devices.

### Device types from spec
- Batteries
- Alternators
- Chargers
- Solar
- Inverters
- AC buses

### Topology constraints
- Derived from `associatedBus` only.
- No explicit DC load nodes; load is reported by batteries, inverters, and other devices.

### Fixed slot layout (1200x700 viewBox)
- Left column: Sources (4 slots)
  - Source-1: x=40, y=40, w=260, h=140
  - Source-2: x=40, y=200, w=260, h=140
  - Source-3: x=40, y=360, w=260, h=140
  - Source-4: x=40, y=520, w=260, h=140
- Center top: Inverter/Charger bridge (1 slot)
  - Inverter: x=460, y=120, w=320, h=180
- Center bottom: Battery banks (2 slots)
  - Bank-1: x=320, y=420, w=260, h=180
  - Bank-2: x=620, y=420, w=260, h=180
- Right column: Loads (2 slots, computed totals)
  - AC Loads: x=900, y=80, w=260, h=140
  - DC Loads: x=900, y=300, w=260, h=140

### Connector behavior
- Simple orthogonal paths between slot anchor points.
- Flow dots animate along SVG paths using `getTotalLength` and `getPointAtLength`.

### Reuse strategy
- Embed BMS and Solar widgets as compact device cards via `widget-embedded`.
- Use a card-mode config schema with `displayMode=card` and a defined metric list.


## Decisions Summary
- Discovery: hybrid (auto-discover + user select)
- Grouping: user-defined banks
- Aggregation: simple sums
- Visual flow: animated dots on SVG paths
- Reuse: `widget-embedded` with card mode configs
- No explicit DC load nodes
