## History Data for Charts


KIP can automatically request historical data points when opening chart widgets, seamlessly integrating past data with live updates.

This enables the display of minutes, hours, days, or weeks of pre-populated historical data immediately—no waiting, no empty charts. The History API is used to achieve this.

---

## What Is the History API?

A Signal K server endpoint that provides access to recorded historical data. KIP automatically requests historical data points when opening chart widgets, pre-filling the chart instead of starting empty.

---

## Which Widgets Support History?

### Data Chart Widget
- **Supported**: Yes, fully seeded with history data when available.
- **Requirements**: Time scale = minutes or longer.
- See "Configure Time Scales" below for more details.

### Wind Trends Widget
- **Supported**: Yes, uses fixed paths (True Wind Direction and Speed).
- **Requirements**: Time Span of `5 minutes` or `30 minutes`.
- See [Wind Trends Fixed Paths](#wind-trends-fixed-paths) below for configuration details.

### Numeric Widget (with Mini Chart)
- **Supported**: No. Mini charts use very short time windows (12 seconds) and skip history seeding.
- Mini charts start live-only for performance reasons.

---

## What Plugins and Signal K Version Are Required?

The History API requires Signal K version 2.22.1 or above and one plugin that records data to a persistent store. Currently, two plugins support the History API:

### 1. signalk-to-influxdb2, v2.0.0 or above
- **Purpose**: Records Signal K data to an InfluxDB v2 time-series database. Requires pre-installed InfluxDB v2.
- **Link**: [signalk-to-influxdb2](https://www.npmjs.com/package/signalk-to-influxdb2)
- **Setup**: Consult the plugin documentation for installation and configuration.
- **Path Configuration**: By default, records all paths. Configure filters, resolution, and other settings to match the paths you want available in KIP charts.

### 2. signalk-parquet, (supporting version not release yet)
- **Purpose**: Records Signal K data to Parquet files for efficient storage and querying. No external database installation required.
- **Link**: [signalk-parquet](https://www.npmjs.com/package/signalk-parquet)
- **Setup**: Consult the plugin documentation for installation and configuration.
- **Path Configuration**: Specify which paths to record in the plugin settings. None are recorded by default.

---

## How History Data Works in KIP

### History Seeding
When you open a chart widget with a larger time scale (minutes/hours):
1. KIP checks if history data is available via the History API.
2. If available and the time window allows (resolution >= 1000ms), KIP requests historical data points.
3. The chart immediately displays the historical trend.

### Live Updates
After history data loads:
- New data points arrive continuously via Signal K's live WebSocket connection.
- The chart smoothly transitions from history to live updates.
- Old data points are removed to maintain a rolling window of the configured time scale.

### When History Is Not Available
- If a History API plugin is not installed, or the plugin report the path is not recorded, history requests are skipped silently.
- The chart will display only live data starting from when it was opened.
- This is normal and does not indicate an error.

---

## Wind Trends Fixed Paths

The Wind Trends widget uses two fixed Signal K paths:
- **True Wind Direction**: `environment.wind.directionTrue`
- **True Wind Speed**: `environment.wind.speedTrue`

For Wind Trends to display historical data, both of these paths **must be configured in your chosen History API plugin**. Check your plugin documentation to ensure these paths are included in the capture list.

---

## Troubleshooting

### History Data Is Not Showing

**Check 1: Is the History API plugin installed?**
- Confirm that a History API plugin is installed and enabled on your Signal K server.
- Verify that the plugin is running without errors (check server logs).

**Check 2: Are the paths configured in the plugin?**
- Open your plugin's configuration settings.
- Confirm that the paths you're charting (e.g., `navigation.speedThroughWater`) are in the capture list.

**Check 3: Is there historical data available?**
- If the plugin was just installed, data will start recording from that moment forward.
- Charts will not show history for times before the plugin was enabled or the path configured for recording.
- Allow the plugin to record data for a while (days or weeks) before expecting deep history.

**Check 4: Is the chart time scale eligible?**
- Very short time scales (seconds) skip history seeding for performance.
- Use time scales of **minutes or longer** to enable history seeding.

**Check 5: Are there any network or permission issues?**
- Confirm that KIP can reach the Signal K server's History API endpoint. Use the OpenApi link in the Server Admin pages to the test.
- Check browser console logs (F12) for any HTTP errors from history requests.

---

## Next Steps

1. Verify that a History API plugin is installed on your Signal K server.
2. Configure the plugin to capture the paths you want to chart.
3. Wait for plugin to capture enough data to fill your Data Chart's time span.
4. Open a Data Chart or Wind Trends widget with a time scale of minutes or longer.
5. Allow the chart to load—history data will appear if available.
6. For more details, consult your plugin's documentation and the Signal K community resources.

---

## Questions or Issues?

- Refer to the plugin and History API documentation for plugin-specific configuration and troubleshooting.
- For general questions or issues, see `Contact-Us` help page—the KIP community is active on Discord and GitHub.
