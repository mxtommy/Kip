# V 1.3.1
* Angular production build script update
* fixed historical widget axis and label theming color, thanks VibroAxe
# V 1.3.0
* Platform update to Node 14, Angular and Angular Material 12
* Upgrade to Awesomefont6 with new icon style classes update
* Retired old node-sass in favor of new Sass module
* Dependecies updated to latest
* App manifest added, thanks VibroAxe
* Added new ng server dev configuration with map files enabling debugger breakpoints. Use: ng server --configuration=dev to enable VS Code debugger map file and inline break points.
* Fixed issue: Latest Master doesn't build #111 - NG-Canvas-Gauge package dependecy
* Fix Kip N2K Autopilot gauge buttons layout and modes feature. AP Gauge should work with Raymarine Seatalk, N2K APs and SmartPilots connected to Seatalk-STNG-Converter device. Latest n2k-signalk (2.5.2+) and signalk-autopitot (v1.2.5+) plugin are required.

# V 1.2.3
* Fix bug in ng-Gauges initialization
* Don't error out on missing notification method
* Add some more help videos

# V1.2.2
* Option to make historical graphs vertical, thanks ahm4711!

# V1.2.1
* Fix bad base href in V1.2.0

# V1.2.0
## Features
* Zones!!!
  * Set zones in Settings, give range and state for that range.
  * Warnings and alarms generated when in range.
  * Radial / Linear Gauges show zones. Sets colors on gauge and red value on warn/alarm.
  * Numeric widget alarming on Zones. Red text on warning, flashing red background on alarm.
* New Data Browser feature!
* Start of a Help section (still needs some more content, feel free to suggest ideas!)
* Enable/Disable different notification sounds in settings (normal/warning/alarm/etc)
* Added choice between numeric and cardinal ticks on compass (0,90,180,270 vs N,E,S,W)
* Allow paths that do not exist in path input.
* Added percent unit
* Optimize font size calculations by up to 50x on numeric widget
* Added a new color option on linear gauges (No Progress). Makes it just the needle, usefull for example rudder position

## Bugfix/Other
* Refactor alarms/notification service.
* Fix blank config version
* Update Dependencies to latest (Angular 11)
* Fix full tree API parsing (might not work with very old server versions though...) (commit 30220f0)
* Fix various small typos / small bugs
* Position updates are in deg, but KIP expects rad. Convert deg to rad on incoming position data.
* Fix metadata parsing

# V1.1.2
* Don't save unlock status in config (not needed)
* Add hPA/mbar units
* Fix unit selection on historical widgets

# V1.1.1
* Fix base Href

# V1.1.0
* A lot of code cleanup!
* UI refresh/cleanup
* Updated dependencies to latest Angular/etc
* Path selection dropdown in Widget settings modal replaced with auto-complete. Also has path description if available
* Config has UUID to that instance (for identifying to server)
* Settings page has updates per second graph
* Start of support for metadata in widgets
* additional notifications settings
* fix Wind gauge wind sectors theming
* Widget select modal refactor into groups

### V1.0.3
* updated navbar styling
* Theme work/cleanup
* Work on ng gauges
 
### V1.0.2
* Tooltip for long messages, and hide badge when 0 unacked alarms 

### V1.0.1
* Respect methods for alarms! 

# V1.0.0
* add ngcanvasgauges and new modern theme (thanks godind!)
* new Theme change event allowing widgets to subscribe to theme changes (thanks godind!)
* Historical Graph color change on theme update
* Update WidgetString to use canvas like numeric widget for dynamic font size
* Latitude/Longitude Unit format
* Load / Save config from server!
* Notifications service for application status (snackbar)
* Deleting the last widget in a page deletes the page!
* Signalk Notifications in menubar!

### V0.1.12
* iFrame to embed something in kip
* Unit defaults!

### V0.1.11
* Performance fixes for large numeric widgets
* Bugfixes

### V0.1.10
* Numeric Min/Max


### V0.1.9
* Updated NPM dependencies
* Show connection lost overlay on closed websocket connection
* Only resize Steelseries Gauges max 1 a second (helps in resizing)
* Add Frequency Units
* Put Support! On/Off and Momentary support on boolean state
* Request R/W token from SignalK Server

### V0.1.8
* Fix bug related to source parsing in deltas

### V0.1.7
Note, Any configs stored in browser will be lost as config format has changed.
* Performance gain in Numeric widget in large fonts
* Sailgauge updates (laylines, windsectors, general refactor)
* Simplified source selection in the code
* Removed Derived Data
* Added Percentage unit, and stopped showing "no unit" on numeric
* Updated Angular from v4 to v5 and also all dependencies to latest version
* Complete re-write of widget settings modal for future ease of coding
* Complete re-write of unit conversion service. Now if metadata specifies unit, it only offers you compatible units
* Gauge Background and frame color options!
* new Signal K Theme

### V0.1.6
* Hash based routing
* Start of Boolean state widget
* default to /signalk in url

### V0.1.5
* fix select dialogs (missing mat-form-field)

### V0.1.4
* Fix typo in settings page

### V0.1.1
* Tutorial Widget
* fix new page bug (had to reload to access it)

### V0.1
* Derived Data - true wind and dow
* Sailgauge (True wind)
* Demo default config
* Load/Save Config
* Get a few themes going, theme wind gauge
