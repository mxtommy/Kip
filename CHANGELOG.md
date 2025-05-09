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
