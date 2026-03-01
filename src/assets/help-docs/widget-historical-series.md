

## Widget Historical Chart

Widgets that use numeric paths automatically track and store data for their configured paths. This lets you easily view charts showing the last 15 minutes, 1 hour, 8 hours, or 24 hours of data.

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
When you open a chart widget with a large time scale (minutes or larger):
1. KIP requests historical data points.
2. The chart immediately displays the historical trend.

### Live Updates
After history data loads:
- New data points arrive continuously.
- The chart smoothly transitions from history to live updates.
- Old data points are removed to maintain a rolling window of the configured time scale.

## How Does Historical Widget Data Work?

KIP and its server-side plugin work together to seamlessly monitor dashboard and widget configurations. For numeric and chart-type widgets (such as Data Chart and Wind Trends), time-series data is automatically captured and managed in the background. For the Data Chart widget, this enables pre-filling the chart instead of starting empty.

Time-series data is pruned automatically, retaining only the data required by active widgets and only for the time ranges those widgets display. This process is fully transparent, requires no manual intervention, and keeps server storage efficient and lean.

This feature uses History-API query/request, introduced in Signal K version 2.22.1.

## Configuration Options

Configuration options are found in **Settings → Options → Display** under the Widget Historical Data section.

You can:
- Disable KIP's automatic time-series and data capture services and use a History-API provider of your choice. See [Using The History-API](history-api.md) in the Integrations Help menu for more details.
- Disable access to widget historical charts (disables two-finger tap, mouse right-click, or two-finger click on trackpads).

If you don't want to use this feature, set the option to use a History API provider (this turns off the plugin's data collection), and disable widget historical charts to also disable the UI elements.

## Questions or Issues?

- Refer to [Using The History-API](history-api.md) to learn how to use other History API providers.
- For general questions or issues, see the `Contact-Us` help page—the KIP community is active on Discord and GitHub.
