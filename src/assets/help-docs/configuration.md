# Configuration Management

KIP provides a "Login to Server" option that determines where your configuration is stored. It is **strongly recommended** to enable server login in the **Settings** under the **Connectivity** tab. This ensures your configurations are stored remotely on the Signal K server and allows automatic loading of configuration from any device. See the "Creating a Signal K user" section below for information on how to create a user.

- **Login to Server Enabled** (recommended setting): Configuration is stored remotely on the Signal K server. This mode allow automatic loading of your configuration from any device (also known as configuration sharing).
- **Login to Server Disabled** (default value): Configuration is saved on your computer/device, in the browser's private storage. In this mode, the configuration is per browser.

You can manage your configurations using the **Configurations** page, accessible from the right menu. Depending on your login mode, different management options are available.

## Creating a Signal K User

To log in to Signal K, you must first create a user. Follow these steps to create a Signal K user:

1. Navigate to the Signal K server's **Security > Users** menu.
2. Click **Add** to create a new user.
3. Provide a **User ID** and **Password** for the user.
4. Assign **Read/Write** permissions at a minimum. To allow access to the Global storage scope, assign **Admin** permissions as well.
5. Click **Apply** to save the new user.

## Login to Server Mode

*In this mode, your configuration is shared across all devices **as long as you authenticate to Signal K using the same User ID**. It's that simple!*

On the **Configurations** page, you can perform the following actions:

- **Backup**: Save the currently active configuration. Backups can be created in different scopes (see below for details).
- **Delete**: Permanently delete a backup configuration. This action is irreversible.
- **Restore**: Replace the active configuration with a selected backup and reload the app. It is recommended to back up your active configuration before restoring, to avoid losing it.

### Storage Scopes

When using "Login to Server" mode, you can save and retrieve configuration backups from different storage scopes. Think of storage scopes as separate folders:

- **User Scope**: Each user has their own private storage space. Users cannot access or view each other's storage.
- **Global Scope**: Accessible only to users with Signal K "Admin" permissions. This shared storage space allows configuration backups to be shared between users. To share configurations, both users must, at least temporarily, have admin permissions.

## Planning Configurations

If you log in with the same user credentials, your configuration will be consistent across all devices and browsers. 

To manage configurations for different devices, stations, or roles, you can create separate Signal K users, each with their own configurations. This approach allows you to tailor configurations to specific use cases. Plan carefully to take full advantage of KIP's flexible configuration management.

## Local Storage

If you do not log in to the server, KIP saves and retrieves configuration changes using your browser's local storage. In this mode:

- Each browser instance has its own independent configuration.
- Configurations **cannot be shared** between different devices or browsers.
- Configuration management is limited to downloading and uploading configuration files.

## Advanced Operations

Use advanced operations with caution. All changes affect your active configuration in real time and are irreversible.

KIP separates configuration into two parts:
1. **Server Connection**: This configuration is always stored locally in your browser and is never shared. It is used in the **Connectivity** tab of the **Settings** page.
2. **Application Settings**: This includes the configuration settings you can back up, delete, and restore with the **Configurations** page. It contains all dashboards, widgets and other configuration settings.
