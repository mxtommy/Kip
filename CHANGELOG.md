# V 2.10.0
## New features
* Boolean Control Panel Widget: Support for numeric paths (0/1 PUT values)
* New Compass Gauge Widget with support for rad units using negative to port values, needle or faceplate rotation support
* Signal K Metadata support for Zones configuration, Display Name and Display Scale. IMPORTANT: Exiting gauges gauge Min & Max setting will be lost on upgrade and require manual configuration of new Scale Start and Scale End Widget Options. 
* Ability to filter Widget Option's path selection list based on Signal K Units type
## Improvements
* Linear Gauge Widget support for tick bar numbers improving readability
* Refactoring of Signal K Notification support with improved integration. Includes Notification options to Silence and Clear messages on the server. Also fixes existing ghost messages issue and normal state notifications that generated unwarranted prompts.
## Fixes
* Chromium browser side scrollbar always visible
* Data Chart Widget Simple Moving Average calculation not using latest datapoints
* Gauge library canvas context stack and object destruction memory leaks
* Settings/Storage Load Demo button not persisting configuration in Sing In mode.
* Radial Gauge Widget inaccurate ticks with very larger numbers
* Incorrect demo server URL example in Setting/Signal K panel by @mshulman
## Retired Feature
* KIP local Zones support removed in favor of Signal K Zones configuration. Pre KIP V2.10 configuration will be lost.
* Radial Gauge compass mode options removed
# V 2.9.3
## Improvements
* Reintroduced High Contrast mode in Settings > General options panel
* Correct misspellings for units description by @mshulman
* Tutorial and Help improvements by @mshulman
* README.md file refresh to reflect latest KIP capabilities
* README.md file updates improving How To Contribute instructions by @mshulman
## Fixes
* Radial Gauge tick value label displayed incorrectly with fractional numbers
* Radial Gauge automatic range scaling feature creating value indicator position discrepancies
* Radial and Linear Gauges zone indicators not converted to gauge units settings
* Steel Style Radial Gauge not displaying zones
## New Contributors
* @mshulman made their first contribution
# V 2.9.2 - retracted due to build issues. Republished as 2.9.3
# V 2.9.1
## Improvements
* Dataset meta units support for 'rad' as directional angles
* Dataset direction with wrap-around support
* Dataset directional simple moving average support
* Improved Data Chart path units format selection
## Fixes
* Radial and linear gauge animation timing with data sample rate
* Timers and Observable object clean up
* Dependency bump
# V 2.9.0
## New features
* Dedicated Freeboard-SK Chart Plotter widget. The widget automatically loads the app and supports single sign on using the same user as defined in KIP. Special thanks to Adrian!
## Fixes
* Removed Data Chart's scale grace-factor improving scale definition control.
* Updated demo configuration to reflect latest text color feature and include Freeboard-SK widget on page 2.
# V 2.8.3
## Improvements
* Exposed the ability to set Value scale range in Data Chart widget 
## Fixes
* Invalid "request pending authorization" message displayed after toggling Switch control using the Boolean Control Panel.
# V 2.8.2
## Improvements
* Added Dataset configuration guidance to UI.
## Fixes
* Chromium menu icon layout issues.
* Data Chart empty datapoint when no value received within sample period.
* Race Timer Start/Pause state when switching day/night modes.  
* Zone alarms triggers incorrectly when using both 0 and undefined in a zone scales.
# V 2.8.1
## Fixes
* Prevent endless login loop by adding support for NEVER expires user session token.
* Update left over Historical Data tab descriptions to reference Datasets and Data Chart widget.
# V 2.8.0
## New features
* New Data Chart Widget replacing Historical Widget. Data Chart supports data streaming and Simple Moving Average Series and min, max and average lines over dataset duration. 
* KIP compatibility for remote access using Victron's VRM Portal.
## Retirements
* Removal of theming engine. KIP only uses what was previously labeled as the Modern Dark theme.
## Improvements
* Upgraded to Node.js v18+.
* Upgrade to Angular 17.2
* Migration to Angular MDC components 
* Migration to Standalone components
* New Dataset Service architecture for future support of Signal K Playback and History APIs
* Upgrade to latest Chart.js
* Package dependency updates
# V 2.7.0
## New features
* Boolean Control Panel Widget: Added Push button and Light indicator controls
* Application loading spinner animation during KIP startup replacing the blank screen visible on slow network/devices improving user experience
## Improvements
* Boolean Control Panel Widget Options: Ability to change control position, layout clean up and enhanced responsive design 
* Date & Time Widget Options: Added pre populated selection list of available Time Zones enhancing usability
* Auto Night Mode feature now based on environment.mode path aligning to latest Signal K specifications. The change is backward compatible
## Fixes
* Improved Settings / Storage tab [object Object] error message when Signal K server's Application Storage service is not accessible from KIP   
# V 2.6.0
## New features
* New Boolean Switches Widget. The first addition to a new series of multi-paths boolean Widgets
* Automatic server URL discovery simplifying basic KIP configuration 
## Improvements
* Request/Response 403 Status Code message improving end user troubleshooting when using PUT operations. Applies to Boolean and AP widgets. 
* Sass styles cleanup reducing css files size
* Dependency cleanup reducing install time and removing unnecessary package installation
* KIP dependency version update 
## Fixes
* Can't save Widget Options with Widgets that have optional configuration features when paths are not available/supplied from Signal K
* Widget Options/Paths form UI validation issues providing cleaner user feedback
* AP compass dial numbers not visible in all themes. Special thanks to @rezder
# V 2.5.0
## New features
* Course Over Ground indicator added to Wind Widget 
## Improvements
* Wind Widget "Laylines" feature label is incorrect and port/starboard wind shift colors are inverted
## Fixes
* Fix Widget Options path filtering with performance improvements
# V 2.4.2
## Fixes
* null path values causing errors, preventing proper value types assignment and default source selection
* Help text and color update
# V 2.4.1
## Fixes
* Progressive Web Application feature for mobile devices
* Random conflicting double tab action on mobile devices causing screen zoom instead of Night Mode activation
* Removed widget data stream filtering of null values 
* Help and data browser navigation actions skipping current widget active page
# V 2.4.0
## New features
* Gesture Support: Added horizontal Swipe to cycle pages and Double Tab to toggle night mode 
* Numeric, Date and Text Widgets: Added configurable color support
* Wind Widget: Added Next Waypoint bearing indicator
* Added support for Widget data expiration (TTL). Previously Widget stayed still when a source stopped sending data or the server connection was lost. 
## Improvements
* Strengthen Widget configuration management when adding new KIP properties 
## Fixes
* Numeric Widget HH:MM:SS conversion unit broken
* Wind Widget speed value indicator sometimes doing a full rotating when passing over zero degrees
# V 2.3.0
## New features
* Added support for Signal K Source Priorities
* Added Signal K RFC 3339 datetime types improving path selection filtering of Date value display Widget and string Widgets
* Added configuration copy from/to all Scopes feature
## Fixes
* Path value of null and undefined causing tofix() failure
* Historic DataSet widget - initial value incorrect and persisted forever
* Typo in "Night Vision" description under the General settings tab
# V 2.2.2
## Fixes
* Add missing SampleTime path property in some rare cases
* Fixed old configuration Device Token upgrade issue
* Fixed upgrading global scope version 1 configuration file with improved UI
# V 2.2.1
## Fixes
* npm package cleanup
# V 2.2.0
## New features
* Option to enable automatic day and night modes activation based on sun phases 
* Path data throttling feature added to Widget Options Paths providing greater flexibility and UI experience
# V 2.1.3
## Improvements
* automatic upgrade of older KIP v6 configuration
# V 2.1.2
## Fixes
* Package description typo and changelog updates
# V 2.1.0
## Improvements
* Cleaner Wind Widget styles and layout with improved visual experience
## Fixes
* 178-wind-gauge-jumping-through-n-0-degrees by @godind in https://github.com/mxtommy/Kip/pull/200
* Unit label typo. Help hyperlinks by @godind in https://github.com/mxtommy/Kip/pull/201
* AP and linear gauge styles by @godind in https://github.com/mxtommy/Kip/pull/202
* Help typo fix by @godind in https://github.com/mxtommy/Kip/pull/203
* Latitude and Longitude format by @godind in https://github.com/mxtommy/Kip/pull/204
* numeric with decimal and long/lat by @godind in https://github.com/mxtommy/Kip/pull/205
* West Longitudes show negatives by @godind in https://github.com/mxtommy/Kip/pull/206
* App-help-styling-to-Angular by @godind in https://github.com/mxtommy/Kip/pull/207
* Bump @babel/traverse from 7.23.0 to 7.23.2 by @dependabot in https://github.com/mxtommy/Kip/pull/194
# V 2.0.1
## Improvements
* KIP icon update
## Fixes
* Object reference error and polyfills by @godind in https://github.com/mxtommy/Kip/commit/73f47aec694ccfe6ea2f1b92ad23dcc53b41e09f
# V 2.0.0
## New features
* Breaking Change - KIP configuration sharing using Signal K user key data storage feature
* Support for Signal K User authentication
* KIP authentication flow and UI
* Race Timer widget
* Data/time Widget. Special thanks to techgardeners
* Ah and kWh units support. Special thanks to amirlanesman
* New Storage Service
* New Authentication Service
* New App bootstrap Init Service
## Improvements
* Button/Switch Widget UI improvement to On/Off status indicator 
* Upgrade to Angular 14
* Performance improvements with reduction of Angular Change Detection
* Reduced bundle size
* Streamlined Widget framework to facilitate Widget contribution and creation
* Migration to RxJS WebSocket
* Improved JavaScript Web Token (JWT) management using HTTP Interceptor
* Improved management of Signal K communications reducing server buffer overflow and server-side termination exceptions handling.
* Support for Signal K Delta Metadata updates
* Retirement of full.service in favor of the Delta service for improved performance, reduced CPU load and code simplification
* Kip configuration data split into Connection and Configuration files enhancing KIP configuration sharing
* Enhanced Request Service support
* Enhanced Console logging for improved tracing and debugging
* Added the ability to add a display text to the Blank widget. Special thanks to techgardeners
* Various dependency upgrades
* Code cleanup and documentation
## Fixes
* widget-numeric.component.html code typo preventing proper theme rendering. Special thanks to mhaberler
* Issue where simple linear gauge assumes min value=0. Special thanks to amirlanesman
* Fix spelling in datasets configuration. Special thanks to philipa 
# V 1.3.1
* Angular production build script update
* fixed historical widget axis and label theming color, thanks VibroAxe
# V 1.3.0
* Platform update to Node 14, Angular and Angular Material 12
* Upgrade to Awesomefont6 with new icon style classes update
* Retired old node-sass in favor of new Sass module
* Dependencies updated to latest
* App manifest added, thanks VibroAxe
* Added new ng server dev configuration with map files enabling debugger breakpoints. Use: ng server --configuration=dev to enable VS Code debugger map file and inline break points.
* Fixed issue: Latest Master doesn't build #111 - NG-Canvas-Gauge package dependency
* Fix Kip N2K Autopilot gauge buttons layout and modes feature. AP Gauge should work with Raymarine Seatalk, N2K APs and SmartPilots connected to Seatalk-STNG-Converter device. Latest n2k-signalk (2.5.2+) and signalk-autopilot (v1.2.5+) plugin are required.

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
* Added a new color option on linear gauges (No Progress). Makes it just the needle, useful for example rudder position

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
* Tooltip for long messages, and hide badge when 0 unacknowledged alarms 

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
* Signal K Notifications in menubar!

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
* Only resize Steelseries Gauges once a second (helps in resizing)
* Add Frequency Units
* Put Support! On/Off and Momentary support on boolean state
* Request R/W token from Signal K Server

### V0.1.8
* Fix bug related to source parsing in deltas

### V0.1.7
Note, Any configs stored in browser will be lost as config format has changed.
* Performance gain in Numeric widget in large fonts
* Sailgauge updates (laylines, wind sectors, general refactor)
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
