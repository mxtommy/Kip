## Historical Widget Data

KIP is built first for live sailing data.  
To make charts useful right away and give you easy access to widget history, KIP includes a simple built-in history feature called **Time-Series**.

The **Time-Series** feature allows KIP to automatically make widget historical data available for quick viewing by:
1. Pre-seeding Data Chart and Wind Trends so they show recent trends immediately.
2. Display charts containing widgets historical data by tracking dashboard and widget configuration, and automatic prunning of old or unused data.

it is meant for users whom need simple short term history and:
* No extra setup.
* No plugin to install.
* No data capture or storage rules and retention policies to configure.

It is made for quick, hassle-free chart history, not data engineering.

## Time-Series
- Works automatically with your dashboards and widgets.
- Stores only the data KIP needs for widget history and chart startup.
- Keeps a small rolling history and removes older data.
- If you change widgets or chart paths, KIP updates history storage rules automatically.
- You cannot manually manage what or how data gets recorded .

### What Time-Series Don't Do
- KIP’s built-in Time-Series is not meant to be a full data-logging solution. You cannot manually set capture paths, sampling policies, long-term retention or advanced rules. Use other plugins and External History Provider for this purpose (see History-API documentation). 
- The dialog window displaying widget history offers **a fixed set** of the last 15 minutes, 1 hour, 8 hours, or 24 hours of data. If you are in need of more flexible and powerful data analytics capabilities, use Grafana and similar purpose built, comprehensive platforms.

## Accessing Time-Series
You access Time-Series chart directly from a locked dashboard:

- **Touch devices:** Two-finger tap a numerial value widget
- **Desktop / mouse:** Right-click a numeral value widget or two-finger click on trackpads

Time-Series chart displays recorded data (no live stream overlay).

## Widgets Support
Most widgets that use numeric paths support Time-Series, including the Horizon widget.

### Chart Type Widgets Support
Time-Series automatically captures data per the chart widget
configuration and seeds charts using this data.

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
- Node.JS v20.5.0+: The built-in automatic Time-Series feature (integrated management of data) uses node:sqlite released in Node.JS v20.5.0.
- Signal K version 2.22.1+: The history querying service uses the History-API v2, introduced in Signal K version 2.22.1.

## Configuration Options

Configuration options are found in **Settings → Options → Display** under the Widget Historical Data section.

You can:
- Disable KIP's automatic Time-Series in favor of the History-API provider of your choice (See [External History-API Provider](#/help/history-api.md) in the Integrations Help menu for more details).
- Disable access to widget historical charts dialogue (disables two-finger tap, mouse right-click, or two-finger click on trackpads).

If you want to completely disable the history feature, under the **Settings → Options → Display** tab in the Widget Historical Data group:
- Select "Other: Use a different History API provider and configure data logging manually" option. This stops the plugin's data capture and historical query services.
- Toggle the "Disable widget historical charts" switch. This disables pointer events to access the charts dialogue window.

### External History Provider (advanced)

KIP can disable its built-in Time-Series/provider registration and query any History-API compatible provider instead.  
You then manage capture and retention in that provider.

Choose this if you need full control, such as:

- Long-term record keeping.
- Custom retention and sampling rules.
- Analytics or integration with other tools.

When you switch to an external History-API provider, KIP still uses History API queries, but capture/retention behavior is managed by that provider so you then have to **manually manage capture and retention in that provider**.

See [External History-API Provider](#/help/history-api.md) for details.

## Questions or Issues?

- Refer to [External History-API Provider](#/help/history-api.md) to learn how to use other History API providers.
- For general questions or issues, see the `Contact-Us` help page—the KIP community is active on Discord and GitHub.
