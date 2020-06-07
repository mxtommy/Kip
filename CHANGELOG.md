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