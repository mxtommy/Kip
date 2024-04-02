# About KIP

KIP is powerful marine instrumentation package to display Signal K data. KIP, much like modern expensive MFDs, is very flexible and can be split up in any arrangements and display all kinds of data available to Signal K server.

![KIP](./images/kip-1024.png)

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
  Simply navigate to `http://<Signal K Server URL>:<port>/@mxtommy/kip` to load KIP and enjoy it's features remotely on any device.

### Responsive Design
  KIP adjusts to the device type and form factor for the best possible user experience.

### Touch Devices
- Swipe left and right to cycle trough your Page layouts.
- Double tap to toggle Night / Day modes.

### KIP Mobile App
Run KIP in full screen, with no browser controls visible, just like regular mobile apps. This feature is supported on most mobile OS. Each browser has it's own way of handling PWA deployments.

![KIP PWA mode](./images/kipPhone.png)

To install KIP as an App, first load KIP in the browser. Then follow the steps below:

**iOS**
1. Press the "Share" button
2. Select "Add to Home Screen" from the action popup list
3. Tap "Add" in the top right corner to finish installation.
KIP is now installed and available on your home screen

**Android**
1. Press the "three dot" icon in the upper right to open the menu
2. Select "Add to Home screen"
3. Press the "Add" button in the popup
KIP is now installed and available on your home screen

## User Experience

### Flexible and Easy
  Meant to build purposeful screen(s) with however many widgets you want, where you want them. 

  Quickly split pages into multiple areas, resize and align to your liking, add the widget of your choosing to each area. Need more? Add as many additional pages as you whish to keep your display purposeful. Simply swipe left and right or use the bottom page navigation button to quickly cycle from page to page.
  ![Layouts Configuration Image](./images/KipWidgetConfig-layout-1024.png)
  
  Easy basic widget configuration.
  ![Gauges Configuration Image](./images/KipConfig-display-1024x488.png) 
  
  See what Signal K has to offer that you can leverage with widgets. Select it and tweak the display options your your purpose.
  ![Paths Configuration Image](./images/KipWidgetConfig-paths-1024x488.png)
  
  Many units are supported. Choose your preferred App defaults, than tweak it widget-by-widget as necessary. KIP will automatically convert the units for you.
  ![Units Configuration Image](./images/KipConfig-Units-1024.png) 

## Reusable Widget Library
  All KIP Widgets are visual presentation controls that are very versatile with multiple advanced configuration options available to suit your needs:
  - Numeric display: Create gauges to display any numerical data sent by your system - SOG, Depth, Winds Speed, VMG, refrigerator temperature, weather data, etc.
  - Text display: Create gauges to display any textual data sent by your system - MPPT state, vessel details,Next Waypoint, Fusion radio song information, noon and sun phases, any system components configuration detail or statues available, etc.
  - Date display: a timezone aware control with flexible presentation formatting support.
  - Boolean Control Panel: A switch board to configure and operate remote devices - light switches, bilge pump, solenoid, any Signal K path that support boolean PUT operations.

  - Linear gauge: Visually display any numerical data on a vertically or horizontally scale - Tank and reservoir levels, battery remaining capacity, etc.
  - Linear electrical gauge: A visual display for electrical numerical data - chargers, MPPT, shunt, etc.
  - Radial gauge: Visually display any numerical data on a radial scale - heading, compass, Speed, etc.
  - Radial and linear Steel gauge: Old school look & fell gauges.

  - Wind Steering Display: Your typical sailboat wind gauge.
  - Freeboard-SK Chart Plotter: A high quality Signal K implementation of Freeboard.
  - Autopilot Head: Operate your autopilot from any device remotely.
  - Data Chart: Visualize data trends over time.
  - Race Timer: Track regatta start sequence.
  - Embedded Webpage: A powerful way of integrating any web based content or application within with your KIP layout - Grafana dashboards, Node-RED dashboard, internet weather services, Youtube, Netflix, Twitter, Gmail, your own standalone webapp, you name it!

  Get the latest version of KIP to see what's new!
### Widget Samples
  Various
  ![Sample Gauges Image](./images/KipGaugeSample1-1024x545.png)
  
  Electrical and Tank Monitoring Sample 
  ![Electrical Concept Image](./images/KipGaugeSample2-1024x488.png)

  Freeboard-SK Integration
  ![Freeboard-SK Image](./images/KipFreeboard-SK-1024.png)

  Grafana Integration 
  ![Embedded Webpage Concept Image](./images/KipGaugeSample3-1024x508.png)

  ## Night Mode
  Keep your night vision with a simple double tap. The below image looks very dark, but at night...it's perfect!

  ![Night mode](./images/KipNightMode-1024.png)

  ## Harness The Power Of Data State Notifications
  Stay informed with notifications about the state of the data you are interested in.
  As an example, KIP will notify you (inform, warn, alert) when a water depth or temperature sensors reaches certain levels. In addition to KIP's centralized basic visual and audio notification feature, each Widget offers a tailored visual representation appropriate
  to their design objectives providing an optimal user experience.

  ## Multiple User Profiles
  If you have different roles on board; captain, skipper, tactician, navigator, engineers or simply different people with different needs, each can tailor as they wish. The use of profiles can also offer the ability to tie specific configuration arrangements to use case or device form factors.

# Connect & Share
KIP has it's own Discord Signal K channel to get in touch. Join us at https://discord.gg/AMDYT2DQga

# Feature, Ideas, Support
See KIP's GitHub project for latest feature request.
https://github.com/mxtommy/Kip/issues


# How To Contribute
KIP is under MIT license and is built with Nodes and Angular using various open-source assets. All free!

**Tools**
Linux, Mac, Pi or Windows dev platform supported
1. Install the latest Node version (v16+, v18 recommended)
2. Download your favorite coding IDE (we use the free Visual Code)
3. Create your own GitHub KIP fork.
4. Configure your IDE's source control to point to your forked KIP instance (With Visual Code, GitHub support is built-in) and get the fork's Master branch locally.
5. Install `npm` and `node`. On macOS, you can use `brew install node` if you have homebrew.
6. Install the Angular CLI using `npm install -g @angular/cli`

**Coding**
1. From your fork's Master branch, create working branch with a name such as: New-Widget-abc or fix-issue-abc, etc.
2. Checkout this new Branch.
3. In a command shell (or in the Visual Code Terminal window), go to the root of you local project branch folder, if not done automatically by your IDE.
4. Install project dependencies using NPM package and dependency manager: run `npm install`. NPM will read Kip project dependencies (see Steps 2), download and install everything automatically for you.
5. Build the app locally using Angular-CLI: from that same project root folder, run `ng build`. CLI tool will  build KIP.

**Setup**
1. Fire up your local dev instance with `npm run dev`.
2. Hit Run/Start Debugging in Visual Code or point your favorite browser to `http://localhost:4200/@mxtommy/kip`. Alternatively to start the dev server and connect using remote devices use such as your phone: `ng serve --configuration=dev --serve-path=/@mxtommy/kip/ --host=<your computer's IP> --port=4200 --disable-host-check`
3. Voila!

*As you work on source code and save files, the app will automatically reload in the browser with your latest changes.*
*You also need a running Signal K server for KIP to connect to and receive data.*

**Apple PWA Icon Generation**
Use the following tool and command line:
`npx pwa-asset-generator ./src/svg-templates/KIP-icon.svg ./src/assets/ -i ./src/index.html -m ./src manifest.json -b "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.15) 100%), radial-gradient(at top center, rgba(255,255,255,0.40) 0%, rgba(0,0,0,0.40) 120%) #989898" -p 5%`

**Share**
Once done with your work, from your fork's working branch, make a GitHub pull request to have your code reviewed, merged and part of the next release.

**Communication and Collaboration**
Join us on Slack -> Signalk-dev / Kip channel. We will hook up and assist as best we can.
