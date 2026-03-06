## What is Historical Widget Data

KIP is built first for live sailing data.  
To make charts useful right away and give you easy access to widget history, KIP includes a simple built-in history feature called Time-Series.

With this built-in feature, KIP automatically:
1. Keeps widget history available for quick viewing.
2. Pre-seeds Data Chart and Wind Trends so they show recent trends immediately.
3. Syncs with dashboard and widget configuration, and automatically prunes old or unused data.

## Who Is It For

This is for users who want history to “just work”:
* No extra setup.
* No plugin to install.
* No data storage rules and retention policies to configure.

It is made for quick, hassle-free chart history, not data engineering.

## Built-In Time-Series vs External History Provider

### Built-In Time-Series (default)
- Works automatically with your dashboards and widgets.
- Stores only the data KIP needs for widget history and chart startup.
- Keeps a small rolling history and removes older data.
- If you change widgets or chart paths, KIP updates history storage rules automatically.
- No screen to manually manage what gets recorded.

#### What Time-Series Don't Do
- KIP’s built-in Time-Series is not a full data-logging system. You cannot manually set capture paths, sampling policies, or long-term retention rules in built-in mode. Use an External History Provider for this purpose. 
- The dialog window displaying widget history offers **a fixed set** of the last 15 minutes, 1 hour, 8 hours, or 24 hours of data. If you are in need of more flexible and powerful data analytics capabilities, use Grafana and similar purpose built, comprehensive platforms.

### External History Provider (advanced)

KIP can disable its built-in Time-Series/provider registration and query any History-API compatible provider instead.  
You then manage capture and retention in that provider.

Choose this if you need full control, such as:

- Long-term record keeping.
- Custom retention and sampling rules.
- Analytics or integration with other tools.

When you switch to an external History-API provider, KIP still uses History API queries, but capture/retention behavior is managed by that provider so you then have to **manually manage capture and retention in that provider**.

See [External History-API Provider](#/help/history-api.md) for details.

## Accessing Widget Historical Charts

### Locked Dashboard Quick View
You can open a widget history dialog directly from a locked dashboard:

- **Touch devices:** Two-finger tap a widget
- **Desktop / mouse:** Right-click a widget or two-finger click on trackpads

This dialog displays only historical data (no live stream overlay).

## Which Widgets Support History?
Most widgets that use numeric paths support history, including the Horizon widget.

## Which Chart Widgets Support Data Seeding?

### Data Chart Widget
- **Supported:** Yes, fully seeded with history data.
- **Requirements:** Time scale must be minutes or longer.

### Wind Trends Widget
- **Supported:** Yes, fully seeded with history data.
- **Requirements:** Time span of `5 minutes` or `30 minutes`.

### Numeric Widget's Mini Chart
- **Supported:** No. Mini charts use very short time windows (12 seconds) and skip history seeding.
- Mini charts start live-only for performance reasons.

### History Seeding
When you open a dashboard containing a Data Chart/Wind Trends widget with a large time scale (minutes or larger):
1. KIP requests historical data points.
2. The chart immediately displays the historical trend.

### Live Updates
After history data loads:
- New data points arrive continuously.
- The chart smoothly transitions from history to live updates.
- Old data points are removed to maintain a rolling window of the configured time scale.

## What are the Requirements for Historical Widget Data To Work?

I use KIP's Time-Series built-in feature:
- Node.JS v20.5.0+: The built-in automatic Time-Series feature (integrated management of data) uses node:sqlite released in Node.JS v20.5.0.
- Signal K version 2.22.1+: The history querying service uses the History-API v2, introduced in Signal K version 2.22.1.

I use an External History Provider:
- Signal K version 2.22.1+: The history querying service uses the History-API v2, introduced in Signal K version 2.22.1.

## Configuration Options

Configuration options are found in **Settings → Options → Display** under the Widget Historical Data section.

You can:
- Disable KIP's automatic Time-Series in favor of the History-API provider of your choice (See [External History-API Provider](#/help/history-api.md) in the Integrations Help menu for more details).
- Disable access to widget historical charts dialogue (disables two-finger tap, mouse right-click, or two-finger click on trackpads).

If you want to completely disable the history feature, under the **Settings → Options → Display** tab in the Widget Historical Data group:
- Select "Other: Use a different History API provider and configure data logging manually" option. This stops the plugin's data capture and historical query services.
- Toggle the "Disable widget historical charts" switch. This disables pointer events to access the charts dialogue window.

## Questions or Issues?

- Refer to [External History-API Provider](#/help/history-api.md) to learn how to use other History API providers.
- For general questions or issues, see the `Contact-Us` help page—the KIP community is active on Discord and GitHub.
