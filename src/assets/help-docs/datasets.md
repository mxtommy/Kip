## Datasets and Data Chart Widget

Datasets and the Data Chart widget work together to provide real-time data visualization in KIP. They allow you to collect and display historical data trends for Signal K paths, enabling better decision-making and monitoring. This guide explains how to configure and use Datasets and the Data Chart widget effectively.

## What Are Datasets?

Datasets are background processes that record path values over time. They are designed to provide a short historical view of data trends, offering visual cues to enhance decision-making. Datasets are not intended to replace full-fledged data logging or analysis tools like Grafana. Instead, they serve as lightweight tools for real-time monitoring and visualization.

### Key Features of Datasets:
1. **Real-Time Data Collection**:
   - Datasets collect data points for a specific Signal K path at regular intervals (e.g., every 5 seconds).
   - These data points are stored temporarily and used to generate visualizations.

2. **Short-Term Historical View**:
   - Datasets provide a limited historical view of data trends, ideal for quick insights rather than deep analysis.

3. **Customizable Time Scales**:
   - You can configure the time scale for data collection (e.g., seconds, minutes, or hours) to suit your needs.

4. **System Resource Management**:
   - Care should be taken to manage datasets efficiently, as excessive data collection can impact system performance.

## What Is the Data Chart Widget?

The Data Chart widget is a visualization tool that uses datasets to display data trends over time. It renders line graphs based on the dataset's collected data points.

### Key Features of the Data Chart Widget:
1. **Real-Time Graphs**:
   - Displays data trends in real time, updating as new data points are collected.

2. **Customizable Appearance**:
   - Configure the chart's appearance, including colors, label, scales and other options.

## How to Use Datasets and the Data Chart Widget Together

### Step 1: Create a Dataset
1. **Open the Datasets Page**:
   - Navigate to the **Datasets** page from the KIP Action menu.

2. **Add a New Dataset**:
   - Click the **Add** button to open the dataset configuration modal.

3. **Configure the Dataset**:
   - **Path**: Select the Signal K path you want to monitor (e.g., `navigation.speedThroughWater`).
   - **Source**: Choose the data source (e.g., `default` or a specific device).
   - **Time Scale**: Set the interval for data collection (e.g., every 5 seconds).
   - **Duration**: Define how long the dataset should retain data points (e.g., 1 hour).

4. **Save the Dataset**:
   - Click **Save** to start collecting data for the selected path.

### Step 2: Configure the Data Chart Widget
1. **Add the Widget to Your Dashboard**:
   - Open the dashboard editor and add a **Data Chart** widget.

2. **Select a Dataset**:
   - In the widget configuration, choose the dataset you created in Step 1.
   - Select your preferred data display format (e.g., knots to km/h) in the Dataset Tab.

3. **Customize the Chart**:
   - Configure the chart's appearance:
     - **Labels**: Add a widget display the widget label.
     - **Colors**: Customize the graph's color scheme.
     - **Series**: Customize the series to display.
     - **Scales**: Customize the scales of the graph.
     - **Datasets**: Customize what dataset to include.

4. **Save the Widget**:
   - Save the widget configuration to display the chart on your dashboard.

## Practical Use Cases

1. **Monitor Speed Trends**:
   - Create a dataset for `navigation.speedThroughWater` and display it in a Data Chart widget to monitor speed trends over time.

2. **Track Environmental Data**:
   - Use datasets to collect data for paths like `environment.wind.speedApparent` or `environment.temperature` and visualize them in real time.

## Tips for Managing Datasets

1. **Limit the Number of Datasets**:
   - Avoid creating too many datasets to prevent excessive resource usage.

2. **Choose Appropriate Time Scales**:
   - Select a time scale that balances data granularity with system performance. Solar Panel performance data is meaning full over hours, not seconds.  

3. **Regularly Review Datasets**:
   - Periodically review and delete unused datasets to free up resources.

4. **Combine with Other Tools**:
   - If data analytics requirements go beyond a simple visual, eg. if you need to transform, process or summarize the data, if the data needs to be persisted on restart of KIP, etc.

## Summary

Datasets and the Data Chart widget are powerful tools for real-time data visualization in KIP. By collecting and displaying historical data trends, they provide valuable insights to help you monitor and manage your vessel's systems. With proper configuration and management, you can use these tools to enhance decision-making and improve situational awareness.
