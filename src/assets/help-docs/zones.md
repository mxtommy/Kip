#### Harness the Power of Data State Notifications
Stay informed about the state of data emitted by Signal K. For example, Signal K can mark data states so that when depth or temperature sensors reach certain levels, KIP can visually or audibly alert the user. A depth of 3 meters or less might be flagged as alarming, prompting KIP to enhance the data presentation with additional visual or audio cues. This feature combines **Zones Configuration** and **Notification Methods** in Signal K.

Zones and notifications are defined as metadata. If you have internet access, you can learn more about this topic at [Signal K Metadata](https://signalk.org/specification/1.7.0/doc/data_model_metadata.html). To configure Signal K's metadata, access the [Data Browser server page](/admin/#/databrowser) and toggle the **Meta Data** switch. You need to configure or add **methods** and **zones** for each path you want to monitor.

IMPORTANT: Zone range values use base units. For example, the speed unit for Apparent Wind Speed (`environment.wind.speedApparent`) is in meters per second (m/s). Define the zone ranges using each path's base unit. KIP will convert the zones ranges and values automatically based on your widgets unit setting. 

You can consult path and unit specifications using the [Keys Reference (Vessel)](https://signalk.org/specification/1.7.0/doc/vesselsBranch.html) and [Keys Reference (Other)](https://signalk.org/specification/1.7.0/doc/otherBranches.html).

##### Notification Configuration
You can use KIP's **Settings > Notifications** tab to filter and override notification states, as well as configure audio prompts to suit your needs.

##### Displaying Zones and Notifications Information
- **Notifications Menu**: This menu lists all active notifications along with their details, such as the path, severity level, and message content. From this menu, notifications can be silenced or resolved. The Notifications menu is hidden on the right side by default. When notifications are received, a large button will appear in the lower-right corner. Tapping or clicking this button will open the Notifications Menu. You can also access the menu at any time by swiping right.
- **Individual Widgets**: Widgets such as **Numeric**, **Linear**, **Radial**, and **Steel Style** offer tailored visual representations of notifications. These widgets highlight relevant data ranges and provide an optimal user experience by integrating notifications into their design.
