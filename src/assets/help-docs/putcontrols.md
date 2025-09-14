## Digital Switching and using PUT Commands

Signal K allows users to update data paths and trigger device reactions. This can include turning a light on or off, dimming it, activating a bilge pump, or other similar actions. This guide explains how to use the Switch Panel or Slider widgets to achieve this, how to verify if a path supports data reception (known as PUT-enabled in Signal K terms), and what is required to enable PUT functionality.

## What is Required to Trigger Device Reactions
For Signal K to accept any data from a client application, the application must be authenticated with a valid security token. Read the **Login & Configurations** help section for details on how to setup login in KIP. By default, sending data to a Signal K path only updates the value and broadcasts it to the network. No actions are taken unless an action handler is configured to respond to the updated value. For example:
- Sending a PUT 'engage' command to `self.steering.autopilot.state` will update the state value, but the autopilot will not engage unless a handler (the autopilot plugin in this case) is set up to process the command and communicate with the hardware.

To enable action handles, you have several options:
1. **Install a Plugin**:
   - The simplest option is to look in Signal K's Appstore. There are many plugins already available in the Signal K ecosystem such as plugins for (Shelly)[https://www.shelly.com], (Sonoff)[https://sonoff.tech/collections/diy-smart-switches] and standard N2K, like the (Yacht Devices)[https://www.yachtd.com] YDCC. Search for the plugin you need, install it, and configure it.
   
2. **Use Node-RED's Signal K PUT Handler**:
   - Node-RED is a visual and easy-to-learn automation platform installed with Signal K. The Signal K team has created Signal K-specific Node-RED nodes, allowing you to easily automate your vessel. You can find Node-RED in the Webapps section of the Signal K Admin site.

3. **Build Your Own Plugin**:
   - If no existing plugin meets your needs, you can create a custom Signal K plugin to handle PUT commands for your specific requirements. See: [Getting Started with Plugin Development](https://github.com/SignalK/signalk-server/blob/master/docs/develop/plugins/README.md)

## Checking for PUT Support
To verify if a path supports PUT:
1. Open KIP's **Data Inspector** located in the right sidebar.
2. Search for the desired path (e.g., `self.electrical.switches.bank.0.1.state` or just `self.electrical` to list many).
3. Look for a green check indicator in the **PUT Support** column. If PUT is not enabled/supported, the path will not be listed in the path selection options of widgets designed to send data.

## Types of Path Data That Are Supported
KIP currently supports the following types of paths for widgets:
1. **Boolean Paths**:
   - Supported by the Switch Panel widget.
   - These paths toggle between `true` and `false` values (e.g., turning a device on/off).

2. **Numerical Data Ranges**:
   - Supported by the Slider widget.
   - These paths allow for a range of numeric values (e.g., dimming a light or adjusting volume).

For backward compatibility, boolean paths can also support numerical data types with `1/0` values. However, this legacy mode is discouraged. If needed, you can enable this mode by selecting the "Use Numeric" checkbox below the control.

## Using the Switch Panel or Slider Widgets
1. **Open the Widget Configuration**:
   - Add a Switch Panel or Slider widget to your dashboard.
   - Double-tap the widget to access its configuration options.
   - Configure the widget to use the desired Signal K data path from the list of PUT-enabled paths.

2. **Verify the Path**:
   - Use the **Data Inspector** to search for the data path you want to update.
   - Check if the path has **PUT Support** enabled. Paths with PUT support allow you to send updates to Signal K.

3. **Send Updates**:
   - Once configured, use the widget to send updates to the selected path. For example:
     - A Switch Panel can toggle a boolean value (e.g., turning a device on/off).
     - A Slider can adjust a numeric value (e.g., setting a dim percentage or audio system volume level).
    - Use the **Data Inspector** to search for the data path and see the updated path value.
    * If you find you have issues or need to troubleshoot further, using the Signal K Data Browser to validate path configuration, metadata, value or consult the server logs is also a best practice.  

## Summary
To update Signal K data with PUT commands:
1. Verify PUT support for the path using the Data Inspector.
2. Enable PUT support by installing a plugin, building one, or using Node-RED with the Signal K PUT Handler.
3. Use the Switch Panel or Slider widgets to send updates.

With these steps, you can effectively update Signal K data and trigger actions on your vessel's systems.
