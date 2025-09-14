## Harness the Power of Data State Notifications

Stay informed about your vessel’s data with Signal K’s state notifications. For example, Signal K can flag certain sensor readings—such as depth or temperature—when they reach critical levels. KIP can then visually or audibly alert you. For instance, if the depth drops to 3 meters or less, KIP can highlight this with a warning sound or visual cue. This powerful feature combines **Zones Configuration** and **Notification Methods** in Signal K.

---

## Zones & Notification Configuration

**Zones** are value ranges defined as metadata for each data path. Learn more at the [Signal K Metadata documentation](https://signalk.org/specification/1.7.0/doc/data_model_metadata.html).  
To configure metadata in Signal K, visit the [Data Browser server page](/admin/#/databrowser) and enable the **Meta Data** switch. Here, you can add or edit **methods** and **zones** for any path you want to monitor.

> **Note:** Zone values use base units (e.g., wind speed in meters per second). Define your zone ranges using the base unit for each path. KIP will automatically convert and display these values according to your widget’s unit settings.

For more details on path units, see the [Keys Reference (Vessel)](https://signalk.org/specification/1.7.0/doc/vesselsBranch.html) and [Keys Reference (Other)](https://signalk.org/specification/1.7.0/doc/otherBranches.html).

As path values move between zone ranges, Signal K generates a notification sent to KIP. Each notification includes a state (severity), optional presentation methods (visual and/or sound), and an optional message.

---

### Zone State and Method Guidance

- The **Nominal** and **Emergency** zones are special-purpose zones and should not be used.
- You do **not** need to configure a **Normal** zone; it is the default when no other zone matches.
- KIP displays a notification in the Notifications menu for all zone states that include the **visual** method, except for the **Normal** and **Nominal** zones. Excluding the **visual** method for a zone does not prevent supporting widgets from displaying zones. This can be achieved by configuring individual widgets to ignore zones settings.
- KIP emits audio prompts for all zone states that include the **sound** method, except for the **Normal** and **Nominal** zones.
- KIP uses predefined, state specific sound files.
- You can configure KIP to globally ignore audio prompts in **Settings > Notifications**; this applies globally to all notifications and paths.

**Tips:**
1. You don’t need zones for every path.
2. You don’t need to configure every zone for a given path. Only configure what is really needed. For example, if all you want is to be alerted at 20% State Of Charge, just add one zone with the Alarm state and method. No need for Warn and Alert zones in this case.
3. Don't enable the **visual** method if you don't want a zone state in the Notifications menu.
4. Keep your zone setup simple—too many Notifications can become overwhelming.

---

### Taking Action on Notifications

You can **Silence** or **Resolve** notifications.  
- Most notifications should resolve automatically when the underlying data returns to a normal range. Exceptions to this rule are the Emergencies such as MOB, Fire, etc. which requires manual resolution.
- For example, if a temperature alert is raised, take action to lower the temperature and wait for the sensor to report a normal value. You can **Silence** a Notification if needed. Silencing does not revolve the Notification. 
- Manually resolving a notification tells Signal K to treat the current value as **Normal** until a new value is received. **Normal** zones method have no visual and sound methods defined.

**Important:**  
- Signal K and KIP do **not** persist data through power cycles. If a device is off when Signal K starts, no value or notification will be present until then device is powered on and it sends data.
- If you turn off a device, then resolve its last notification, it will remain resolved until the device is powered back on and sends new data.
- Different devices send data at different intervals—some multiple times per second, others as infrequently as once per day. Check your device or plugin documentation for details. Once a notification is silenced or resolved, it will stay in this state until a new value is received and evaluated.

---

## Displaying Zones and Notifications

- **Notifications Menu:**  
  The Notifications Menu lists all active notifications, including details such as path, severity, and message. You can silence or resolve notifications directly from this menu. At the bottom of the Notifications menu, you will find a Mute button. This button mutes the notification volume. It does not Silence the notifications. It is meant as a quick noise cancelling button to spare your ears until you resolve the issue(s) but has no effect on the notifications.
  
  By default, the Notifications menu is hidden; when a notification arrives, a prominent button appears in the lower-right corner to alert you of changes in notifications. Tap or click this button to open the menu, or swipe right to access it at any time.

- **Individual Widgets:**  
  Widgets such as **Numeric**, **Simple Linear**, **Linear**, **Radial**, and **Steel Style** visually highlight relevant data ranges according to their configured zones and integrate notification states into their display. You can configure each widget to ignore zones if desired.

---

## KIP Notification Configuration Override

In **Settings > Notifications**, you can customize which notification states are displayed and enable or disable audio prompts to suit your preferences.

> **Note:** Muting all notifications will also mute other KIP system sounds, such as those played when KIP connects to or disconnects from Signal K, not just zone-related alerts.
