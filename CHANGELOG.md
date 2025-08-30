# v 3.9.0
# New Feature
* A new dashboard navigation experience. Introducing our all-new Dashboard sidenav designed for speed. Effortlessly jump between dashboards with a single tap, always knowing exactly where you are thanks to clear highlighting of your current dashboard.
* Discover the brand new Settings button at the top of the sidenav. Instantly access tools to manage your dashboards, plus quick links to Options, Data Inspector, and Help—all in one place.
* Personalize your dashboards with style: double-click any dashboard to open the new icon gallery and give each page a unique visual identity.
* All configuration controls are now streamlined as tabs within the Options page, making customization faster and more enjoyable than ever.
# Improvements
* Reduced GPU memory usage to improve performance and stability, especially on low-end hardware such as the RPi Zero 2.
* Added canvas bitmap blitting for better rendering speed and visual performance.
* Replaced HammerJS with native gesture support for improved responsiveness.
* Updated CSS to help prevent accidental page reloads and unwanted text selection on mobile devices.
* Enabled Notification audio on mobile.
# v 3.8.2
# Improvements
* Faster app loading with local font and font swap support
* Linux/RPi UI cleanup with removal of unnecessary scroll bars in multiple pages
* Increased mobile Wake Lock support
* Help component active page marker
## Fixes
* Dashboard card Drag & Drop and Long Press event collision preventing dashboard reordering in Chromium.
# v 3.8.1
## Improvements
* Expose option to invert pitch and roll axes in Horizon gauge widget
* Enhance memory management and lifecycle handling
* Application dependencies updated
# V 3.8.0
## New features
* Pitch & Roll widget: Horizon-style attitude display for live pitch and roll, helping monitor vessel motion in sea state.
## Improvements
* Radial gauge: Progress bar start position (left, middle, right) — enables split-from-center and regressive styles.
* Linear gauge: Needle option refined — tick values and bars are centered within the needle for better readability.
* Add Widget dialog: Optional plugin dependency awareness and display.
## Fixes
* Widget resize: Touch events could stop responding. Fixes #759
* Racer Start Line widget: Correct rotation button direction. Thanks @gregw — Fixes #757
# V 3.7.0
## New features
* Real‑time True Wind Trends widget with dual top axes for direction (°) and speed (kts). Shows live values plus SMA over the period average for faster tactical wind shift / pressure awareness.
## Improvements
* Data Chart layout: Cleaner vertical option, optional min/max line, flexible top/right axes, larger fonts for readability.
* Dataset Service circular angle stats: Correct mean/SMA/min/max for wrap‑around angles (no 0→360 jump spikes) for smoother, accurate trends.
* Widget categories: New Core & Racing groupings (retired "Basic") reduce hunting time and clarify purpose.
* Configuration upgrade guidance: More prominent tips ease migration and new input control adaptation after upgrades.
* Help access: "Get help" button on empty dashboards boosts documentation visibility and user support.
* Tutorial widget: Clearer instructions improve first‑time user experience.
* Help documentation updates.
## Fixes
* Enforce WSS under HTTPS to avoid mixed‑content issues. _Contribution by @tkurki_
* Server reconnect counter should not resets when switching tabs; removed redundant snackbar action button.
## New Contributor
* @tkurki made their first contribution
# V 3.6.1
## Fixes
* Dashboard swipe gesture over Freeboard-SK and Embed widgets not changing dashboard. Fixes #744
* Path Options form with hardcoded paths falsy reported as invalid 
* Display of Windsteer widget's True Wind Angle indicator is not optional
# V 3.6.0
## Improvements
* Numeric widget now features mini background charts for instant visual trend insights
* Data Chart widget now supports vertical orientation and inverted value scales for greater flexibility
* Data Chart loading speed and resource usage significantly improved, enabling smoother performance with large datasets
## Fixes
* Fixed login loop bug in V3.4+ when KIP is run on Signal K server and authentication is denied
# V 3.5.1
## Fixes
* Dashboard ID URL not redirecting to dashboard instance (/mxtommy/kip/#/dashboard/1)
* Widget resize handles too small to operate with fingers on smaller screens
* Display network connection and socket error messages only
* WebSocket retry should not stop after five attempts
# V 3.5.0
## New features
* Gain tactical racing advantages with new signalk-racer plugin integrated widgets for start line analysis and  race countdowns. _Contribution by @gregw_
## Improvements
* Optimized dashboard loading and switching speed for a more responsive user experience.
* Optimized Data Chart widget for significantly faster loading and smoother performance.
* Added Simple Linear widget zones support.
* Automatic detection of Signal K Autopilot API version for seamless integration.
* Enforced widget minimum dimension for better layout consistency.
* General framework updates and codebase refactoring for maintainability and performance.
## Fixes
* Dataset service does initialize on early app startup.
* Data Chart widget resets data when automatic night mode is enabled.
* Gauge widgets does not correctly distribute highlights over dynamic scales.
* Sidebar swipe gesture functionality stops responding in one direction.
## New Contributors
* @gregw made their first contribution
# V 3.4.2
## Fixes
* Stripped Vessel Base Delta path first character
# V 3.4.1
## Fixes
* Improve dashboard loading speed and keydown handling
* Fix null path configuration option when path is not required
# V 3.4.0
## New features
* Enhanced empty dashboard experience with intuitive visual guidance and one-click customization prompts for seamless onboarding
## Improvements
* Advanced recursive data flattening engine converting complex nested objects into accessible data paths for improved widget compatibility
* Completely redesigned networking architecture with state machine management for enhanced connection reliability, performance, and user experience
## Fixes
* Autopilot widget now properly handles 'off-line' connection states with appropriate visual indicators
* Removed unit conversion option from slider widget UI to preserve original path format integrity
# V 3.3.0
## New features
* New autopilot widget with responsive UI.
* New Wind Steering widget UI:
  * Added Current/Drift and Set.
  * Improved wind speeds visibility.
  * Apparent wind used for tack angle and sector calculation.
* Widget server plugin dependency validation and UI enhancements.
## Improvements
* Add support for optional and hardcoded paths in widgets increasing flexibility.
* Add days:hours:minutes:Seconds to Time unit format options. Fixes #682.
* Reduce package size.
* Support for Date values provided in metadata. Fixes #665. Special thanks to @emonty
* Add code linter. Special thanks to @emonty
* Add project documentation.
## Fixes
* Fix bouncy slider when selecting non-default value display. Fixes #671
* Position type paths should not be converted to radian. Fixes #670
* Numeric Widget has scrollbar on resize for some browsers. Fixes #640
# V 3.2.0
## New features
* Add automatic reconnection on mobile OS app resume
## Fixes
* Data Chart form error with invalid dataset uuid
# V 3.1.7
## Fixes
* Linear gauge not respecting scales with no ticks. Fixes #621
* Text overlap on low resolution screens. Fixes #624
* Minor performance improvement to Data Chart widget
# V 3.1.6
## Fixes
* Fix embed overflow scrollbar
* Fix canvas cleanup process
* Harden known webkit canvas bug with custom webfont 
# V 3.1.5
## Fixes
* Swipe sensitivity reported by trackpad device users
* Sidebars occasionally stops responding to swipes
* Documentation: Embed widget, Dataset & Data Charts and Data Inspector guides update
# V 3.1.4
## Fixes
* Help section on Updating Signal K Data (using PUT commands)
# V 3.1.3
## Fixes
* Switch Panel Indicator control only listing PUT enabled paths. Fixes #609
# V 3.1.2
## Fixes
* Embed widget not accepting relative URL and causing issues when loading KIP embeds on devices other then the server  
# V 3.1.1
## Fixes
* Missing image assets
* Only enable metadata supportsPUT path filter for SK v2.12 or more
# V 3.1.0
## Improvements
* Add option the allow input device events on Embed widget content. Fixes 602
* Add signal K plugin presence and enabled status service.
## Fixes
* Data Chart widget not applying red night mode.
* Update Tutorial text.
# V 3.0.1
## Fixes
* Fixes Embedded Web Page not working after 3.0 upgrade. Fixes #598
# V 3.0
## New features
- Touch first user experience with hotkey support
- Fullscreen dashboards experience with the removal of the bottom navbar
- New grid Dashboard layout for easy widgets rearrangement
- New deep black and true white themes for improved sunlight contrast.
- Seven new high contrast colors available.
- Widget duplication feature
- Increased Gauge color reaction to Zones highlights enhancing data state awareness
- Ability to disregard Zones configuration in applicable widgets
- Ability to have no unit label for unitless paths
- New Position widget. Special thanks to @mantas_sidlauskas 
- New Slider widget
- New Label widget
- Dashboard pages can be labeled, reordered and duplicated
- New additional low Brightness+Sepia Night mode for those whom want to keep colors at night.
- Simplified configuration management. Configuration file download & upload support
- Redesigned Notification user experience 
- Enhanced Data Inspector user experience including identification of PUT supported paths
- New Inch, Millimeter and Fuel economy units. Special thanks to @emonty
- Redesigned Help section
- Enhanced Responsive design on tablets and mobile
### Fixes
- Boolean Panel label cut off #582
- Conversion of seconds to HH:MM:SS loses sign #581
- Token renewal loop #580
- Fix Toggle Switches Boolean Control Panel - Push mode not not changing color on touchscreen #579
