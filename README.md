# About Kip 

Kip is a marine instrumentation package to display Signal K data. Kip, much like modern expensive MFDs, is very flexible and can be split up in any arrangement and display any kind of data available.

# Design Goal

The idea is to replicate the functionality of MFDs such as the B&G Triton, Raymarine i70, or Garmin GMI20.
- Display should be fullscreen and not require any scrolling
- Anything displayed should be as big as possible in the given space
- Touchscreen user experience should be excellent
- Layout and configuration should be both easy to operate and flexible
- Compatibility with Chromium browser and other device form factor important (**HELP WANTED)  

# Features
## User Experience
### Built-in Theme Sample
  Request a theme and send us inspirational/reference material (web sites, picture, etc.). If we fall in love, we will do it. Even better, branch and contribute. We will assist and guide!

  Modern Dark Theme
  ![Modern Dark Theme](./KipSample-1-1024x488.png)
  
  Signal K Inspired Theme
  ![Signal K Inspired Theme](./KipSample-2-1024x488.png)
  
  Light Blue Theme
  ![Light Blue Theme](./KipSample-3-1024x488.png)

### Accessible Night Mode
  Keep your night vision with a quick Night Mode access button, regardless of the selected theme. The below image looks very dark, but at night...it's perfect!

  ![Light Blue Theme](./KipNightMode-1024x488.png)


## Gauge Layout and Configuration
### Flexible and Easy
  Built purposeful screen(s) with however many auges or display widgets you want, where you want them. 

  Split or delete gauge zones, resize and position, then simply add the gauge of your choosing. Add as many pages as you whish to keep screens purposeful.
  ![Layouts Configuration Image](./KipWidgetConfig-layout-1024x488.png)
  
  Easy basic gauge and widget configuratio.
  ![Gauges Configuration Image](./KipConfig-display-1024x488.png) 
  
  See what Signal K has to offer that you can leverage in a gauge. Select it and tweak the display options for your purpose.
  ![Paths Configuration Image](./KipWidgetConfig-paths-1024x488.png)
  
  Many units are supported. Choose your prefered App defaults, than tweak it gauge-by-gauge as necessary. Kip will convert the displayed units for you.
  ![Units Configuration Image](./KipConfig-Units-1024x488.png) 

### Reusable Gauge and Widget Library
  All Kip Gauges and Widgets are visual presentation controls that are very versatile with multiple configuration options available to suit your needs:
  - Text display: Create gauges to display any textual data sent by your system - MPPT state, Timezone date and time, Next Waypoint, Fusion radio song information, noon and sun phases, any system components configuration detail or statues available, etc.
  - Numeric display: Create gauges to display any numerical data sent by your system - SOG, Depth, Winds Speed, VMG, refrigerator temperature, weather data, etc.
  - Wind gauge: Your typical sailboat wind gauge
  - Autopilot: Operate your autopilot from any device remotely 
  - Linear gauge: Visually display any numerical data on a vertically or horizontally scale - Tank and reservoir levels, battery voltage, etc.
  - Linear electrical gauge: A visual display for electrical numerical data - chargers, MPPT, shunt, etc.
  - Radial gauge: Visually display any numerical data on a radial scale - heading, compass, Speed, etc.
  - Radial and linear Steel gauge: Old school look & fell gauges
  - Button and Switch control: Operate remote devices - light switches, bildge pump, solenoid, any Signal K device that support boolean PUT operations
  - Race Timer: Track regatta start sequence
  - Historical datagram chart: Display numerical data over time on a chart
  - Embedded Webpage: A powerful way of embedding any web based content or application accessible as a URL within an onscreen widget to integrate with your gauges and layout - Grafana dashboards, Node-RED dashboard, internet weather services, Youtube, Netflix, Twitter, Gmail, your own standalone webapp, you name it!

  Get the latest version of Kip to see what's new!

  Sample gauge types
  ![Sample Gauges Image](./KipGaugeSample-1-1024x545.png)
  
  Electrical and Tank monitoring sample 
  ![Electrical Concept Image](./KipMonitor-1024x488.png)

## Share Configuration And Access From Anywhere
  Configure once and seamlessly share the layout and configuration on multiple devices and browsers (computer, phones, tablets,
  Raspberry Pi, etc.) by pointing to a single Signal K server URL address from anywhere.

# Developing

Kip is built on Angular using various open-source assets. All free!

**Tools**

Linux, Macs, Pi or Windows dev platform supported
1. Install the latest Node version
2. Download you favorite coding IDE (we use the free Visual Code)
3. Create your own GitHub Kip fork and configure your IDE source control to point to this Fork (With Visual Code, GitHub support is built-in)

**Setup**
1. Create a GitHub Branch of your own Kip Fork
2. Checkout this new Branch to get the source code locally.
3. In a command shell (or in the Visual Code Terminal window), go to the root of you local project folder.
4. Install project dependencies using NPM package and dependency manager: run `npm install`. NPM will read local Kip project dependencies (see Steps 2), download and install everything automatically for you.
5. Build the app locally using Angular-CLI: from that same project root folder, run `ng build`. CLI tool will read local Kip project configuration (see Tools - steps 4) and build everything.

**Work**
1. Fire up your local dev instance with CLI using `ng serve --configuration=dev`.
2. Point your favorite browser to `http://localhost:4200/` and voila!

*As you work on source code and save files, the app will automatically reload in the browser with your latest changes.*

**Publish**
1. From your Fork's working Branch, make a GitHub pull request to have your code reviewed, merged and part of the next release. 

Or

2. Build your own version:
  1. Use the `-prod` flag for a production build.
  2. To generate a npm package, run `npm run-script build-npm`.
  3. Warning: Git Bash seems to mess up Base Href, fix it in public/index.html if needed
  4. Deploy and have fun! 

**Collaborate**
Join us on Slack -> Signalk-dev / Apps_and_client channel. We will hook up and assist as best we can.

# Feature Ideas
 * Improved Metadata configuration
 * Improved Zones support and alerting
 * AIS Widget
 * GPS information Widget
 * Attitude Indicator Widget
 * Sailing Polars with ChartJS Radar type chart?
 * More Customization options for radial/linear Gauges
 * Pre-created widgets for commonly used displays
