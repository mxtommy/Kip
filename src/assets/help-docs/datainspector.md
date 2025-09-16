## Data Inspector

The Data Inspector is a powerful tool in KIP that allows you to view all Signal K paths and the data received from the server in real time. It provides detailed insights into the data being transmitted, including metadata, sources, and supported operations. This guide explains how to use the Data Inspector effectively.

The Data Inspector is a good way to validate raw data and available paths without the constraints that each widget can impose. It provides a clear and unrestricted view of the data, making it an essential tool for understanding the underlying Signal K data structure.

## How to use the Data Inspector
1. **Filter Paths**:
   - Use the filter input box to narrow down the list of paths using any part of the path, source or value. For example:
     - Type `self.` to view paths related to your vessel.
     - Type `environment` to view environmental data like wind or temperature.
     - Type `speed` to view any speed related data like wind speed, max speed, polar speed, etc.
     - Type `derived` to view all path from source derived-data .

2. **Sort and Navigate**:
   - Click on column headers to sort the data by Path, PUT Support, or Source.
   - Use the paginator to navigate through the list if there are many paths.

## Key Features of the Data Inspector

1. **Real-Time Data Display**:
   - The Data Inspector shows all Signal K paths and their current values as they are received from the server.
   - Data updates in real time, allowing you to monitor changes as they happen.

2. **PUT Support**:
   - You can see if a path supports PUT operations, indicated by a green checkmark in the **PUT Support** column.
   - For more details on PUT support and how to use it, refer to the **Updating Signal K Data** help documentation.

3. **Multiple Data Sources**:
   - The Data Inspector displays how many sources are providing data for each path.
   - You can view the raw data sent by each source and compare their values.

4. **Unit Conversion**:
   - If a path supports unit conversion, you can change the data format to your preferred unit (e.g., converting speed from knots to kilometers per hour).
   - This feature is especially useful to quickly display data in a format that matches your preferences.
   - Changing the units in the Data Inspector does not change KIP's default units or any widget's format settings. It is only for quick consultation.

## Practical Use Cases

- **Validate Raw Data**:
  - Use the Data Inspector to validate raw data and available paths without the constraints that widgets can impose. This is especially useful when setting up new devices or debugging data issues.

- **Verify PUT Support**:
  - Check if a path supports PUT operations before configuring widgets like the Switch Panel or Slider.

- **Troubleshoot Data Issues**:
  - The Data Inspector is a good troubleshooting tool, but it should be matched with the Signal K Data Browser when trying to understand raw data and what is going on. The combination of these tools provides a more complete picture of the data, it's processing and its behavior.

## Summary

The Data Inspector is an essential tool for managing and understanding the data KIP receives from your Signal K server. With its real-time updates, filtering, and unit conversion capabilities, it provides a comprehensive view of your vessel's data. Whether you're monitoring performance, configuring widgets, or troubleshooting issues. For deeper analysis and understanding of raw data, pair it with the Signal K Data Browser to gain even more insights.
