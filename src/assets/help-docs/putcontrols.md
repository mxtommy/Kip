## Digital Switching, Node-RED, and PUT

Use KIP digital switching controls when you want to do real actions from your dashboard, like turning devices on/off, changing levels, or selecting operating modes. This guide helps you choose the right Signal K path for Switch Panel, Slider, and Multi State Switch controls so they work reliably in daily use.

The focus here is practical KIP setup: what path type to use, what PUT support is needed, and how to avoid common configuration mistakes. This guide supports built-in server handlers, custom plugins, and Node-RED flows.

If you are new to Node-RED, start with this guide, then continue with **[Node-RED Control Flows for KIP Widgets (Beginner Guide)](nodered-control-flows.md)** for beginner flow examples.

## What PUT Does (and Does Not Do)

Start with this key idea:

PUT writes a value to a Signal K path. By itself, that write does not trigger hardware or system behavior. For actions to happen, a handler must be registered for that path. The handler reacts to the new value and performs the action. This handler capability is commonly called PUT Support.

Examples of server-side handlers:
- A built-in server handler
- A Signal K plugin
- A Node-RED flow (see [Node-RED Control Flows for KIP Widgets (Beginner Guide)](nodered-control-flows.md))

## Basic Requirements

Check these basics first:

1. For security reasons, KIP must be authenticated against Signal K for the server to accept PUTs.
2. The target path must exist in Signal K and have metadata matching the digital switching widget type.
3. For control widgets that send commands, the path metadata must report that PUT Support is enabled.
4. The appropriate server-side handler must be present to react to value changes and control the targeted hardware.

## Verifying Path Configuration

Use this quick check before widget setup:

1. Open **Data Inspector**.
2. Search for your candidate path (for example `self.electrical.switches.bank.0.1.state`).
3. Confirm the path data type and whether **PUT Support** is enabled (a handler is registered).
4. For Multi State controls, confirm the path metadata includes possible values (use the Signal K Data Browser).

## Path Eligibility by Widget and Control Type

Use this table to match each control to the right path type.

| Widget / Control | Typical Path Type | PUT Required | Notes |
|---|---|---|---|
| Switch Panel → Toggle | `boolean` (preferred) or `number` (`1/0` mode) | Yes | Use **Use numeric path** only when your system expects numeric states. |
| Switch Panel → Push | `boolean` (preferred) or `number` (`1/0` mode) | Yes | Behaves like a momentary action style control. |
| Switch Panel → Indicator | `boolean` or `number` | No (display only) | Indicator is read-only visualization and does not send commands. |
| Slider | `number` | Yes | Best for ranges such as dimmer level or percentage setpoints. |
| Multi State Switch | `multiple` metadata type | Yes | Metadata should expose possible values so options can be shown. |

## Quick Setup Workflow

Follow these steps in order:

1. Install the required plugin or configure a Node-RED flow.
2. If you installed a new plugin, restart the server. If you created a Node-RED flow, make sure the flow is Deployed.
3. If using Node-RED, include a Signal K **put handler** node in your flow so widget commands are received.
4. Confirm path exists in Data Inspector.
5. Confirm type and PUT support are compatible with widget/control type.
6. Configure the widget in KIP.
7. Trigger the control and verify the value changes in Data Inspector.
8. Validate the server-side handler executes the expected real-world action.

## Troubleshooting

If something does not work, check these first.

### Path does not appear in widget config
- Check type compatibility with the control you selected.
- Check **PUT Support** for controls that write values (all except Indicator).

### Value updates but hardware does nothing
- The PUT write is working, but no server-side action handler is registered, or the handler has an error.
- Verify plugin/flow/integration logic and server logs.

### Multi State options are empty
- Confirm the path metadata is type `multiple` and includes possible values.

## Related Guides

Use these guides next as needed.

- **Node-RED beginners:** [Node-RED Control Flows for KIP Widgets (Beginner Guide)](nodered-control-flows.md)
- **Path discovery and validation:** [Data Inspector](datainspector.md)
- **Widget overview and placement:** [Dashboards and Layout](dashboards.md)
