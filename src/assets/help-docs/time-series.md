## Historical Widget Data

KIP is primarily designed for live sailing data. To make charts useful immediately and provide easy access to recent widget history, KIP includes a purpose-built history feature called **Time-Series**.

The **Time-Series** feature manages data capture and pruning. It uses that data to:
1. Pre-seed Data Chart and Wind Trends so they show recent trends immediately.
2. Automatically provide a historical view for widgets in your dashboards that use numeric value paths.

It is meant for users who need simple, short-term history with:
* No extra configuration
* No plugin to install
* No data capture, storage rules, or retention policies to manage

It is designed for quick, hassle-free trend history, not data engineering.

## Time-Series
- Works automatically with your dashboards and widgets.
- Stores only the data KIP needs for widget history and chart startup.
- Keeps a small rolling history and removes older data.
- If you change widget configuration, KIP automatically adds, updates, or removes capture and retention rules.

### What Time-Series Does Not Do
- KIP’s built-in Time-Series is not a full data-logging solution. You cannot manually define capture paths, sampling policies, long-term retention, or advanced rules. For that, use another plugin with an external History API provider (see [History-API Provider](#/help/history-api.md).
- The widget history dialog offers **a fixed set** of time windows: the last 15 minutes, 1 hour, 8 hours, or 24 hours. If you need more flexible analytics, use purpose-built platforms such as Grafana.

## Accessing Time-Series
Access the Time-Series chart directly from a locked dashboard:

- **Touch devices:** Two-finger tap a numeric value widget.
- **Desktop / mouse:** Right-click a numeric value widget or two-finger click on trackpads.

The Time-Series chart displays recorded data only (no live stream overlay).

## Supported Widgets
Most widgets that use numeric paths support Time-Series, including Horizon, Battery Monitor, Solar, and similar numeric-based widgets.

### Chart Type Widgets Support
Time-Series automatically captures data according to each chart widget configuration and uses it to seed charts.

#### Data Chart Widget
- **Supported:** Yes, fully seeded with history data.
- **Requirements:** Time scale must be minutes or longer.

#### Wind Trends Widget
- **Supported:** Yes, fully seeded with history data.
- **Requirements:** Time span of `5 minutes` or `30 minutes`.

#### Numeric Widget's Mini Chart
- **Supported:** No. Mini charts use very short time windows (12 seconds) and skip history seeding.
- Mini charts start live-only for performance reasons.

## Time-Series Technical Requirements
- Node.js v20.5.0+: The built-in automatic Time-Series feature (integrated data management) uses `node:sqlite`, released in Node.js v20.5.0.
- Signal K v2.22.1+: The history query service uses History API v2, introduced in Signal K v2.22.1.

## Configuration Options
>The Time-Series feature is designed to work automatically without configuration. However, you can customize its behavior or disable it if you prefer not to use this feature or to use a different History API provider.

There are two sources of configuration:
1. KIP Plugin: found in Signal K's Admin, Server -> Plugin Config page under KIP. Use these options to manually toggle the server-side data capture and/or history provider features. Note that using the KIP Application options will also automatically turn off the server-side plugin features, so you don't need to configure both unless you are encountering issues.
2.  KIP Application: Configuration options are found in **Settings → Options → Display** under the Widget Historical Data section.

You can:
- Disable KIP's automatic Time-Series in favor of a History API provider of your choice (see [History-API Provider](#/help/history-api.md) in the Integrations Help menu for details).
- Disable access to widget historical chart dialogs (disables two-finger tap, mouse right-click, or two-finger click on trackpads).

If you want to completely disable the history feature, under the **Settings → Options → Display** tab in the Widget Historical Data group:
- Select the "Other: Use a different History API provider and configure data logging manually" option. This stops the plugin's data capture and historical query services.
- Toggle the "Disable widget historical charts" switch. This disables pointer events that open the chart dialog window.

### Using Other History Provider For Greater Flexibility(advanced)

KIP's built-in Time-Series feature can be disabled, allowing you to register and use other History API provider-compatible plugin instead.  
You then manually manage data capture and retention in that provider.

See [History-API Provider](#/help/history-api.md) for details.

## Questions or Issues?

- Refer to [History-API Provider](#/help/history-api.md) to learn how to use other History API providers.
- For general questions or issues, see the Contact-Us help page. The KIP community is active on Discord and GitHub.
