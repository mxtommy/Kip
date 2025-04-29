# About KIP

KIP is a powerful and versatile marine instrumentation package designed to display Signal K data. It replicates the functionality of modern Multi-Function Displays (MFDs) similar to most commercial products, while offering unmatched flexibility and customization. KIP can be tailored to any arrangement, displaying all kinds of data available from the Signal K server.

With its responsive design, KIP works seamlessly across phones, tablets, Raspberry Pi, and computers, ensuring an optimal user experience on any device. It supports touchscreen gestures, night/day modes, and even Progressive Web App (PWA) functionality for a full-screen, app-like experience.

![KIP](./images/KIPDemo.png)

![Form factor support](./images/formfactor.png)

Key features include:
- **Flexible Layouts**: Build purposeful dashboards with an easy-to-use and intuitive grid layout system. Drag widgets into place and make adjustments with simple gestures or clicks.
- **Reusable Widget Library**: A wide range of widgets for numerical, textual, and graphical data, as well as advanced controls like switches, sliders and autopilot operation.
- **Night Mode**: Preserve night vision with a simple tap or automatic switching based on sunrise/sunset.
- **Data State Notifications**: Stay informed with visual and audio alerts for critical data thresholds.
- **Multiple User Profiles**: Tailor configurations for different roles, devices, or use cases.
- **Cross-Device Compatibility**: Access KIP remotely on any device by navigating to `http://<Signal K Server URL>:<port>/@mxtommy/kip`.

KIP is open-source under the MIT license, built by the community and 100% free. Join the community on Discord or contribute to the project on GitHub!

## Basic Instruction
Read the [Introduction](https://github.com/mxtommy/Kip/blob/master/src/assets/help-docs/welcome.md) help file.

# Design Goal

The goal is to replicate and enhance the functionality of modern marine instrumentation displays while providing unmatched customization and flexibility. The design principles include:

- **Full-Screen Utilization**: Ensure the display uses the entire screen without requiring scrolling, maximizing visibility and usability.
- **Optimized for Readability**: Present data in a large, clear, and easily interpretable format to ensure quick comprehension. Utilize high-contrast color schemes to enhance visibility, especially in bright daylight conditions.
- **Touchscreen Excellence**: Deliver an intuitive and seamless experience for touchscreen users, with support for gestures like swiping and tapping.
- **Cross-Device Compatibility**: Guarantee a consistent and responsive experience across phones, tablets, computers, and other devices.
- **Modern Browser Support**: Include support for the latest versions of Chromium and other modern web browsers to ensure optimal performance and compatibility.

## Features

### Intuitive Controls
- Swipe up and down to navigate through your dashboards effortlessly.
- Swipe left and right to access notifications and other system features quickly.
- Use keyboard shortcuts for essential features, ensuring fast and efficient navigation across devices.

### Progressive Web App (PWA) Support
Run KIP in full-screen mode without browser controls, just like a native mobile app. This feature is supported on most mobile operating systems. Follow your browser's instructions to install KIP as a PWA for quick and easy access. It's usually just a few clicks such as "Add to Home Screen".

### Flexible Dashboard Layouts
- Effortlessly create and customize dashboards using an intuitive grid layout system.
- Add, resize, and align widgets to design tailored displays for your specific needs.
- Duplicate widgets or entire dashboards, including their configurations, with a single click.
- Organize and reorder dashboards by adding names and arranging them to suit your workflow.
- Seamlessly switch between multiple dashboards for different roles, devices, or use cases.

### Multiple User Profiles
Create and manage profiles for different roles, devices, or use cases. Each profile can have its own dashboard configurations and settings.

### Open Source and Community-Driven
KIP is built with modern web technologies and is open-source under the MIT license. Like many others, join the community on Discord or contribute to the project on GitHub to help shape its future.

## User Experience

### Flexible and Easy
  Meant to build purposeful screen(s) with however many widgets you want, where you want them. 

  Add, resize and position the widgets of your choosing. Need more? Add as many additional dashboards as you whish to keep your display purposeful. Simply swipe up and down to quickly cycle dashboards.
  ![Layouts Configuration Image](./images/KipWidgetConfig-layout-1024.png)
  
  Intuitive widget configuration.
  ![Gauges Configuration Image](./images/KipConfig-display-1024x488.png) 
  
  See what Signal K has to offer that you can leverage with widgets. Select it and tweak the display options to your purpose.
  ![Paths Configuration Image](./images/KipWidgetConfig-paths-1024x488.png)
  
  Many units are supported. Choose your preferred App defaults, than tweak it widget-by-widget as necessary. KIP will automatically convert the units for you.
  ![Units Configuration Image](./images/KipConfig-Units-1024.png) 

## Reusable Widget Library
All KIP Widgets are visual presentation controls that are very versatile with multiple advanced configuration options available to suit your needs:
- **Numeric display**: Create gauges to display any numerical data sent by your system - SOG, Depth, Winds Speed, VMG, refrigerator temperature, weather data, etc.
- **Text display**: Create gauges to display any textual data sent by your system - MPPT state, vessel details,Next Waypoint, Fusion radio song information, noon and sun phases, any system components configuration detail or statues available, etc.
- **Label**: A static text widget.
- **Date display**: a timezone aware control with flexible presentation formatting support.
- **Position display**: Position coordinates in textual format.
- **Boolean Control Panel**: A switch board to configure and operate remote devices - light switches, bilge pump, solenoid, any Signal K path that support boolean PUT operations.
- **Slider**: A versatile control that allows users to adjust values within a defined range by sliding. Commonly used for settings like light intensity, volume control, or any parameter requiring fine-tuned adjustments.
- **Simple Linear gauge**: A visual display for electrical numerical data - chargers, MPPT, shunt, etc.
- **Linear gauge**: Visually display any numerical data on a vertically or horizontally scale - Tank and reservoir levels, battery remaining capacity, etc.
- **Radial gauge**: Visually display any numerical data on a radial scale - Boat Speed,Eond Speed, engine RPM,etc.
- **Compass gauge**: A card or marine compass to display directionnal data such as heading, bearing to next waypoint, wind angle, etc.
- **Radial and linear Steel gauge**: Old school look & fell gauges.
- **Wind Steering Display**: Your typical sailboat wind gauge.
- **Freeboard-SK Chart Plotter**: A high quality Signal K implementation of Freeboard integration widget.
- **Autopilot Head**: Operate your autopilot from any device remotely.
- **Data Chart**: Visualize data trends over time.
- **Race Timer**: Track regatta start sequence.
- **Embedded Webpage**: A powerful way of displaying web based apps published on your Signal K server such as Grafana and Node-RED dashboard or your own standalone webapp.

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
Keep your night vision. The below image looks very dark, but at night...it's perfect!

![Night mode](./images/KipNightMode-1024.png)

## Harness The Power Of Data State Notifications
Stay informed with notifications about the state of the data you are interested in.
As an example, Signal K will notify KIP when a water depth or temperature sensors reaches certain levels. In addition to KIP's centralized notification menu, individual Widgets offer tailored visual representation appropriate
to their design objectives, providing an optimal user experience.

## Multiple User Profiles
If you have different roles on board; captain, skipper, tactician, navigator, engineers or simply different people with different needs, each can tailor as they wish. The use of profiles can also offer the ability to tie specific configuration arrangements to use case or device form factors.

# Connect, Share and Support
KIP has it's own Discord Signal K channel to get in touch. Join us at https://discord.gg/AMDYT2DQga

# Feature, Ideas, Bugs
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
5. Build the app locally using Angular-CLI: from that same project root folder, run `ng build`. CLI tool will build KIP.

**Setup**
1. Fire up your local dev instance with `npm run dev`.
2. Hit Run/Start Debugging in Visual Code or point your favorite browser to `http://localhost:4200/@mxtommy/kip`. Alternatively to start the dev server and connect using remote devices use such as your phone: `ng serve --configuration=dev --serve-path=/@mxtommy/kip/ --host=<your computer's IP> --port=4200 --disable-host-check`
3. Voila!

*As you work on source code and save files, the app will automatically reload in the browser with your latest changes.*
*You also need a running Signal K server for KIP to connect to and receive data.*

**Apple PWA Icon Generation**
Use the following tool and command line:
`npx pwa-asset-generator ./src/svg-templates/icon/KIP-icon.svg ./src/assets/ -i ./src/index.html -m ./src manifest.json -b "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.15) 100%), radial-gradient(at top center, rgba(255,255,255,0.40) 0%, rgba(0,0,0,0.40) 120%) #989898" -p 5%`

**Share**
Once done with your work, from your fork's working branch, make a GitHub pull request to have your code reviewed, merged and part of the next release.
