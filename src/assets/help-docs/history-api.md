## Using an External History API Provider

If you disable KIP's built-in Time-Series features and install a compatible History API provider plugin, you can still:
1. Pre-seed Data Chart and Wind Trends so they show recent trends immediately.
2. Populate historical views for widgets in your dashboards that use numeric value paths.

The tradeoff is that you must configure the provider plugin to capture the paths you want to chart, and it must have enough recorded data to cover your chart time span. This is not automatic when using an external provider.

The benefit is greater control, including:
- Long-term record keeping.
- Custom retention and sampling rules.
- Analytics or integration with tools such as Grafana.

## Which Widgets Support History?

As with KIP's built-in Time-Series, most widgets that use numeric paths support history when using an external History API provider, including Horizon, Battery Monitor, Solar, and similar numeric-based widgets. Your provider plugin must be configured to capture the paths you want to chart.

## Required Plugins and Signal K Version

You need:
- Signal K support for History API v2 (introduced in Signal K v2.22.1).
- A compatible History API provider plugin.

Currently, two plugins support History API v2:

### 1. signalk-to-influxdb2 (v2.0.0+)
- **Purpose:** Records Signal K data to an InfluxDB v2 time-series database (requires InfluxDB v2).
- **Link:** [signalk-to-influxdb2](https://www.npmjs.com/package/signalk-to-influxdb2)
- **Setup:** Follow the plugin documentation for installation and configuration.
- **Path Configuration:** By default, records all paths. Configure filters, resolution, and related settings for the paths you want available in KIP charts.

### 2. signalk-parquet
- **Purpose:** Records Signal K data to Parquet files for efficient storage and querying (no external database required).
- **Link:** [signalk-parquet](https://www.npmjs.com/package/signalk-parquet)
- **Setup:** Follow the plugin documentation for installation and configuration.
- **Path Configuration:** You must specify which paths to record; none are recorded by default.

## How History Data Works in KIP

### History Seeding
When you open a chart widget with a larger time scale (minutes/hours):
1. KIP checks whether history data is available through the History API.
2. If available and the time window allows it (resolution >= 1000 ms), KIP requests historical data points.
3. The chart displays the historical trend immediately.

### Live Updates
After history data loads:
- New data points continue to arrive through Signal K's live WebSocket connection.
- The chart transitions smoothly from history to live updates.
- Old points are removed to maintain a rolling window based on the configured time scale.

### When History Is Not Available
- If no History API plugin is installed, or the provider reports that a path is not recorded, history requests are skipped silently.
- The chart shows live data only, starting from when it was opened.
- This is expected behavior and does not indicate an error.

## Provider Plugin Configuration

For performance reasons, KIP charts display a maximum of 120 datapoints. KIP uses the chart's configured time window and asks the provider to return data for that window as up to 120 datapoints.

When configuring provider sampling rates, ensure your rules support this behavior:
- Slower sampling rates produce fewer datapoints (lower visual resolution).
- Faster sampling rates do not produce more than 120 datapoints in KIP charts.

### Widget Historical Charts

For the smallest fixed window (**last 15 minutes**), collect enough samples to provide useful resolution. A sampling interval around 7.5 seconds is ideal; 15 seconds is also usable.

### Wind Trends Fixed Paths

The Wind Trends widget uses two fixed Signal K paths:
- **True Wind Direction:** `environment.wind.directionTrue`
- **True Wind Speed:** `environment.wind.speedTrue`

To display Wind Trends history, both paths **must be captured by your selected History API plugin**.

Choose a sampling rate that supports chart durations of 5 and 30 minutes.

## Limitations

To seed charts with historical data, you usually need to manually configure your provider to collect the required paths. Unlike KIP's built-in Time-Series, this is not automatic.

## Troubleshooting

### History Data Is Not Showing

**Check 1: Are the technical requirements met?**
- Confirm Signal K server v2.22.1 or later is installed.

**Check 2: Is a History API plugin installed?**
- Confirm a History API plugin is installed and only one provider plugin is enabled.
- Verify the plugin is running without errors (check server logs).

**Check 3: Are paths configured in the plugin?**
- Open plugin configuration.
- Confirm the paths you are charting (for example, `navigation.speedThroughWater`) are included in the capture list.

**Check 4: Is there historical data available?**
- If the plugin was installed recently, data is only available from that point onward.
- Charts cannot display history for periods before the plugin was enabled or before the path was configured.
- Allow time for data to accumulate before expecting deeper history.

**Check 5: Is the chart time scale eligible?**
- Very short time scales (seconds) skip history seeding for performance.
- Use chart time scales of **minutes or longer** for history seeding.

**Check 6: Are there network or permission issues?**
- Confirm KIP can reach the Signal K server History API endpoint.
- Use the OpenAPI link in Signal K Server Admin pages to test endpoint availability.
- Check browser console logs (F12) for HTTP errors from history requests.

## Next Steps

1. Verify that a History API plugin is installed on your Signal K server.
2. Configure the plugin to capture the paths you want to chart.
3. Wait for the plugin to collect enough data to fill your chart time span.
4. Open a Data Chart or Wind Trends widget with a time scale of minutes or longer.
5. Let the chart load; history appears when available.
6. For more details, consult plugin documentation and Signal K community resources.

## Questions or Issues?

- Refer to plugin and History API documentation for provider-specific setup and troubleshooting.
- For general questions or issues, see the Contact-Us help page. The Signal K community is active on Discord and GitHub.
