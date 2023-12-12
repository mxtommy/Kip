# About KIP

KIP is powerful marine instrumentation package to display Signal K data. KIP, much like modern expensive MFDs, is very flexible and can be split up in any arrangements and display all kinds of data available to Signal K server.

# Design Goal

The idea is to replicate the functionality of MFDs such as the B&G Triton, Raymarine i70, or Garmin GMI20.
- Display should use the entire screen and not require any scrolling
- Anything displayed should be as big as possible in the given space
- Touchscreen user experience should be excellent
- Layout and configuration should be both easy to operate and flexible
- Phones, tablets, computers and other device and form factors should render well 
- Include support for latest Chromium and other modern browsers

# Features
## Access from Phones, Tablets, Raspberry Pi and Computers
  Simply navigate to `http://<Signal K Server URL>:<Signal K Server port>/@mxtommy/kip` to load KIP and enjoy it's features remotely on any device.

### Responsive Design
  KIP adjust to the device type and form factor for the best possible user experience.

### Touch Devices
- Swipe left and right to cycle trough your Widget layouts.
- Double tap to toggle night mode.

### Run KIP As a Web Application
Run KIP in full screen, with no browser controls visible, just like regular mobile apps. This feature is supported on most mobile OS. Each browser has it's own way of handling PWA deployments.

To install KIP as an App, first load KIP in the browser. Then follow the steps below:

**iOS**
1. Press the "Share" button
2. Select "Add to Home Screen" from the action popup list
3. Tap "Add" in the top right corner to finish installing
KIP is now installed and available on your home screen

**Android**
1. Press the "three dot" icon in the upper right to open the menu
2. Select "Add to Home screen"
3. Press the "Add" button in the popup
KIP is now installed and available on your home screen

## Multiple User Profiles
  If you have different roles on board; captain, skipper, tactician, navigator, engineers or simply different people with different needs, each can tailor as they wish. The use of profiles can also offers the ability to tie specific configuration arrangements to use case or form factors.

## User Experience

### Night Mode
  Keep your night vision with a simple tap, regardless of the selected theme. The below image looks very dark, but at night...it's perfect!

  ![Night mode](./KipNightMode-1024x488.png)

### Built-in Themes
  Use your favorite style from the built-in themes gallery.

  Modern Dark Theme
  ![Modern Dark Theme](./KipSample-1-1024x488.png)

  Signal K Inspired Theme
  ![Signal K Inspired Theme](./KipSample-2-1024x488.png)

  Light Blue Theme
  ![Light Blue Theme](./KipSample-3-1024x488.png)

  NOTE: Request a new theme by sending us inspirational/reference material (web sites, picture, etc.).
  If we fall in love, we will do it. Even better, branch and contribute yourself. We will assist and guide!

## Gauge Layout and Configuration
### Flexible and Easy
  Meant to build purposeful screen(s) with however many gauges or widgets you want, where you want them. 

  Quickly divide the screen area into zones, resize and position, add the gauge of your choosing. Need more? Add as many additional pages as you whish to keep screens purposeful. Simply tap the navigation button keys to quickly rotate from page to page.
  ![Layouts Configuration Image](./KipWidgetConfig-layout-1024x488.png)
  
  Easy basic gauge and widget configuration.
  ![Gauges Configuration Image](./KipConfig-display-1024x488.png) 
  
  See what Signal K has to offer that you can leverage in a gauge. Select it and tweak the display options for your purpose.
  ![Paths Configuration Image](./KipWidgetConfig-paths-1024x488.png)
  
  Many units are supported. Choose your preferred App defaults, than tweak it gauge-by-gauge as necessary. KIP will convert the displayed units for you.
  ![Units Configuration Image](./KipConfig-Units-1024x488.png) 

### Reusable Gauge and Widget Library
  All KIP Gauges and Widgets are visual presentation controls that are very versatile with multiple advanced configuration options available to suit your needs:
  - Text display: Create gauges to display any textual data sent by your system - MPPT state, vessel details,Next Waypoint, Fusion radio song information, noon and sun phases, any system components configuration detail or statues available, etc.
  - Numeric display: Create gauges to display any numerical data sent by your system - SOG, Depth, Winds Speed, VMG, refrigerator temperature, weather data, etc.
  - Wind gauge: Your typical sailboat wind gauge
  - Autopilot: Operate your autopilot from any device remotely 
  - Linear gauge: Visually display any numerical data on a vertically or horizontally scale - Tank and reservoir levels, battery remaining capacity, etc.
  - Linear electrical gauge: A visual display for electrical numerical data - chargers, MPPT, shunt, etc.
  - Radial gauge: Visually display any numerical data on a radial scale - heading, compass, Speed, etc.
  - Radial and linear Steel gauge: Old school look & fell gauges
  - Button and Switch control: Operate remote devices - light switches, bilge pump, solenoid, any Signal K path that support boolean PUT operations
  - Date display: a timezone aware control with flexible presentation formatting support 
  - Race Timer: Track regatta start sequence
  - Historical datagram chart: Display numerical data over time on a chart
  - Embedded Webpage: A powerful way of integrating any web based content or application within with your KIP layout - Grafana dashboards, Node-RED dashboard, internet weather services, Youtube, Netflix, Twitter, Gmail, your own standalone webapp, you name it!

  Get the latest version of KIP to see what's new!

  Gauge types sample
  ![Sample Gauges Image](./KipGaugeSample1-1024x545.png)
  
  Electrical and Tank monitoring sample 
  ![Electrical Concept Image](./KipGaugeSample2-1024x488.png)

  Grafana Embedded Webpage sample 
  ![Embedded Webpage Concept Image](./KipGaugeSample3-1024x508.png)

  ### Harness The Power Of Data State Notifications
  Stay informed with notifications about the state of the data you are interested in.
  As an example, KIP can notify (inform, warn, alert) you when the water depth or a temperature sensor reaches certain levels. In addition to KIP's centralized basic visual and audio notification support, each type of Widget offers a tailored visual representation appropriate
  to their design objectives for an optimal user experience.

# Developing

KIP is built on Angular using various open-source assets. All free!

**Tools**

Linux, Macs, Pi or Windows dev platform supported
1. Install the latest Node version (v16+)
2. Download your favorite coding IDE (we use the free Visual Code)
3. Create your own GitHub KIP fork.
4. Configure your IDE's source control to point to this fork (With Visual Code, GitHub support is built-in) and get the latest Master branch locally.

**Setup**
1. From your fork's Master branch, create working branch with a name such as: New-Widget-abc or fix-issue-abc, etc.
2. Checkout this new Branch to get the source code locally.
3. In a command shell (or in the Visual Code Terminal window), go to the root of you local project folder.
4. Install project dependencies using NPM package and dependency manager: run `npm install`. NPM will read local Kip project dependencies (see Steps 2), download and install everything automatically for you.
5. Build the app locally using Angular-CLI: from that same project root folder, run `ng build`. CLI tool will read local Kip project configuration and set the base href(see Tools - steps 4) and build everything.

**Work**
1. Fire up your local dev instance with `npm run start`.
2. Hit Run/Start Debugging in Visual Code or point your favorite browser to `http://localhost:4200/`
3. Voila!

*As you work on source code and save files, the app will automatically reload in the browser with your latest changes.*
*You also need a running Signal K server for KIP to connect to and receive data.*

**Apple PWA Icon Generation**
Use the following tool and command line: npx pwa-asset-generator ./src/svg-templates/KIP-icon.svg ./src/assets/ -i ./src/index.html -m ./src/manifest.json -b "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.15) 100%), radial-gradient(at top center, rgba(255,255,255,0.40) 0%, rgba(0,0,0,0.40) 120%) #989898" -p 5%

**Share**
Once done with your work, from your fork's working branch, make a GitHub pull request to have your code reviewed, merged and part of the next release.

**Communication and Collaboration**
Join us on Slack -> Signalk-dev / Apps_and_client channel. We will hook up and assist as best we can.

# Feature Ideas
 * AIS Widget - Help Wanted
 * Light indicator Widget for Boolean paths
 * Fuel Consumption Widget
 * GPS information Widget - Help Wanted
 * Improved Metadata configuration
 * Improved Zones support
 * Add a KIP Widget CLI Schematic to automate new Widget creation and improve contribution
 * Improved error logging / performance gain
 * Retire outdated SteelGauges
 * Rebuild alerting to new Signal K Specifications
 * Attitude Indicator Widget - Help Wanted
 * Sailing Polars Widget - Help Wanted
 * More Customization options for radial/linear Gauges
 * Pre-created Widgets for commonly used displays
