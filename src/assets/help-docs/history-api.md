## Using External History-API Provider to Obtain Historical Data 

KIP can, using a special type of plugin called a History Provider, automatically request historical data points when opening chart widgets, seamlessly integrating past data with live updates.

This enables the display of minutes, hours, days, weeks, etc. of pre-populated historical data immediately—no waiting, no empty charts.

## Which Widgets Support History?

### Data Chart Widget
- **Supported**: Yes, fully seeded with history data when available.
- **Requirements**: Time scale = minutes or longer.
- See "Configure Time Scales" below for more details.

### Wind Trends Widget
- **Supported**: Yes, uses fixed paths (True Wind Direction and Speed).
- **Requirements**: Time Span of `5 minutes` or `30 minutes`.
- See Wind Trends Fixed Paths below for configuration details.

### Mini-chart
NOTE: This is the optional chart that can be display in the background of the Numeric Widget.
- **Supported**: No. Mini charts use very short time windows (12 seconds) and skip history seeding.
- Mini charts start live-only for performance reasons.

## What Plugins and Signal K Version Are Required?

You will need both support for the History-API version 2 and a compatible History provider. The History-API version 2 was introduced in Signal K version 2.22.1. Currently, two plugins support the v2 History-API:

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


## How History Data Works in KIP

### History Seeding
When you open a chart widget with a larger time scale (minutes/hours):
1. KIP checks if history data is available via the History-API.
2. If available and the time window allows (resolution >= 1000ms), KIP requests historical data points.
3. The chart immediately displays the historical trend.

### Live Updates
After history data loads:
- New data points arrive continuously via Signal K's live WebSocket connection.
- The chart smoothly transitions from history to live updates.
- Old data points are removed to maintain a rolling window of the configured time scale.

### When History Is Not Available
- If a History-API plugin is not installed, or the plugin report the path is not recorded, history requests are skipped silently.
- The chart will display only live data starting from when it was opened.
- This is normal and does not indicate an error.

## Provider Configuration Information

For performance reasons, all KIP charts display a maximum of 120 datapoints. KIP looks at the chart's configured time span 'window', and ask the provider to gather the requested data and to return results as 120 datapoints.

When configuring your provider's path sampling rates, insure your sampling rules meet this requirement. Slower sampling rates will create charts with fewer datapoints/of lesser resolution. Higher sampling rates will NOT create charts with more datapoints/of higher resolution.

### Historical Widget Charts

Collect an appropriate mount of data samples for the smallest **last 15 minutes** window; every 7.5 seconds. Every 15 seconds is not too bad a resolution either.

### Wind Trends Fixed Paths

The Wind Trends widget uses two fixed Signal K paths:
- **True Wind Direction**: `environment.wind.directionTrue`
- **True Wind Speed**: `environment.wind.speedTrue`

For Wind Trends to display historical data, both of these paths **must be configured in your chosen History-API plugin**.

Plan an appropriate data sampling rate to support the chart duration (5 and 30 minutes are supported).

## Limitations

For historical data to seed charts, you need to, in most cases, to manually configure your chosen provider to collect the said data. This is not an automatic process when using a External History Provider.

## Troubleshooting

### History Data Is Not Showing

**Check 1: Are the Technical Requirements Meet?**
- Confirm that Signal K server version 2.22.1 or above in installed.

**Check 2: Is the History-API plugin installed?**
- Confirm that a History-API plugin is installed and enabled on your Signal K server.
- Verify that the plugin is running without errors (check server logs).

**Check 3: Are the paths configured in the plugin?**
- Open your plugin's configuration settings.
- Confirm that the paths you're charting (e.g., `navigation.speedThroughWater`) are in the capture list.

**Check 4: Is there historical data available?**
- If the plugin was just installed, data will start recording from that moment forward.
- Charts will not show history for times before the plugin was enabled or the path configured for recording.
- Allow the plugin to record data for a while (days or weeks) before expecting deep history.

**Check 5: Is the chart time scale eligible?**
- Very short time scales (seconds) skip history seeding for performance.
- Use time scales of **minutes or longer** to enable history seeding.

**Check 6: Are there any network or permission issues?**
- Confirm that KIP can reach the Signal K server's History-API endpoint. Use the OpenApi link in the Server Admin pages to the test.
- Check browser console logs (F12) for any HTTP errors from history requests.


## Next Steps

1. Verify that a History-API plugin is installed on your Signal K server.
2. Configure the plugin to capture the paths you want to chart.
3. Wait for plugin to capture enough data to fill your Data Chart's time span.
4. Open a Data Chart or Wind Trends widget with a time scale of minutes or longer.
5. Allow the chart to load—history data will appear if available.
6. For more details, consult your plugin's documentation and the Signal K community resources.


## Questions or Issues?

- Refer to the plugin and History-API documentation for plugin-specific configuration and troubleshooting.
- For general questions or issues, see `Contact-Us` help page—the Signal K community is active on Discord and GitHub.
