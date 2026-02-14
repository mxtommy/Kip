## Node-RED Control Flows for KIP Widgets (Beginner Guide)

This guide is for first-time Node-RED users who want KIP control widgets to trigger real actions (like GPIO or relay switching) through Signal K. It is not a full Node-RED product guide or a complete flow-programming course. It focuses on the Signal K and KIP-specific parts you need for digital switching.

Before you start building flows, read **[Digital Switching and PUT Path Setup](putcontrols.md)** so you understand the core concepts, data flow, and control logic.

## What You Are Building

Use this sequence as your basic mental model:

KIP widget → Signal K path (PUT) → Node-RED **put handler** → action node (GPIO/relay/driver/Web Service/etc.)

This is the basic flow:

1. A KIP widget sends a value to a Signal K path (PUT).
2. Node-RED receives that path value through a **put handler** node.
3. Your flow converts or uses that value to perform the final action.

Think of Signal K as the shared data bus and Node-RED as the automation logic.

### Why You Need a PUT Handler in the Flow

To receive commands sent by KIP widgets, your flow needs a Signal K node named `put handler`.

Why it is needed:
- KIP writes values to Signal K paths using PUT.
- The `put handler` listens for PUT updates on those paths.
- Without it, your flow will not receive widget commands, so no action will run.

Where to find it:
- In Node-RED, open the **Signal K** node group.
- Add the node called **put handler** to your flow.

## Before You Start

Check these basics first:

1. KIP is connected and authenticated to Signal K.
2. You can see your target path in Data Inspector, unless you plan to create a new path with your flow.
3. The path type matches your widget type.
4. Your Node-RED environment can access target hardware (GPIO, relay board, Web Service, etc.).

## Safety First

Always test with non-critical outputs first.

- Start with a debug/test path or non-critical device before controlling live systems.
- Validate expected behavior in Data Browser and Data Inspector before switching real loads.
- Add safe defaults so outputs stay in a known state on startup/restart.

## 5-Minute First Success

Goal: prove the full command path works end-to-end (KIP → Signal K PUT → Node-RED `put handler` → value update).

1. In Node-RED, open **Import** (`Cmd+I` on Mac).
2. In **Examples**, go to: `flows -> @signalk/node-red-embedded -> put-handler`, then click **Import**.
3. Open the imported **put handler** node and note the path it listens to (default example: `self.red.autoLights.state`).  
   Leave defaults unchanged for this first test.
4. Click **Deploy**.
5. In KIP **Data Inspector**, search for `self.red.autoLights.state`.
   - Confirm the path exists.
   - Confirm **PUT Support** is enabled.
6. In KIP, add a **Switch Panel** widget:
   - Add a **Toggle** control.
   - Set the control path to `self.red.autoLights.state`.
   - Save/apply widget settings.
7. Toggle ON/OFF in KIP and verify:
   - The widget changes state without error notifications.
   - The value updates in both Signal K Admin Data Browser and KIP Data Inspector.
   - The updated value is visible in Node-RED under the **send autoLights** node (green status dot, e.g. **State: 1**).

Note that this example flow uses numeric `1/0` path values. For ON/OFF control, the preferred value type is `boolean` (`true/false`).

You can change this by double-clicking the **Inject** node labeled `1` and changing `msg.payload` type from `number` to `boolean`.

When changing an existing path type, restart Signal K so the path is recreated with the new type. Path types are not safely changed in-place during runtime.

Remember to click **Deploy** after any flow change.

If this works, your core control pipeline is correctly set up. You can now repeat the same pattern with different path values for Slider and Multi State Switch paths.

## Troubleshooting for Beginners

If something does not work, check these first.

### Widget changes value, but flow does not react
- Verify Node-RED is watching the same exact Signal K path.
- Verify your flow includes a Signal K **put handler** node and it is configured for the same path.
- Verify authentication/permissions and path visibility.

### Flow reacts, but hardware still does nothing
- Verify hardware node wiring, pin mapping, and runtime permissions.
- Test with a known manual value from Node-RED first.

### Multi State widget shows no options
- Metadata is incomplete for that path. Confirm `multiple` type and possible values list in Signal K metadata.

## Suggested Learning Path

Build in this order to keep setup simple.

1. Start with one boolean switch end-to-end.
2. Add one numeric slider flow.
3. Add one multi-state mode flow.
4. After each step, confirm path value in Data Inspector and physical result on hardware.

## Glossary (Beginner)

Use these terms consistently while setting up your flow.

- **PUT**: Writing a value to a Signal K path.
- **Path**: The Signal K key where a value is stored (for example `self.electrical.switches.bank.0.1.state`).
- **PUT Support**: Signal K metadata indicating a path handler will react to PUT writes.
- **put handler**: The Signal K Node-RED node that receives PUT writes from Signal K paths.
- **Metadata**: Extra path information such as type, units, possible values and more.
- **Possible values**: The allowed list of modes/states for a Multi State path.

## Related Guides

Use these guides next as needed.

- SignalK signalk-node-red: [Show and tell](https://github.com/SignalK/signalk-node-red/discussions/categories/show-and-tell)
- Path requirements and widget compatibility: [Digital Switching and PUT Path Setup](putcontrols.md)
- Finding paths and checking PUT support: [Data Inspector](datainspector.md)
- Adding and configuring widgets: [Dashboards and Layout](dashboards.md)
