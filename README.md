# Firefox Proxy Switcher

A Firefox extension that allows selective application of proxy servers to specific domains, providing flexible proxy management for different websites.


<p align="center">
  <a href="https://addons.mozilla.org/ru/firefox/addon/set-proxy-switcher/">
    <img
      src="https://img.shields.io/badge/Get%20it%20for-Firefox-FF7139?logo=firefoxbrowser&logoColor=white"
      alt="Get it for Firefox"
    />
  </a>
  <a href="https://github.com/tsests/Proxy-Switcher">
    <img
      src="https://img.shields.io/badge/Source-GitHub-181717?logo=github&logoColor=white"
      alt="Source code on GitHub"
    />
  </a>
</p>

## Features

- **Domain-specific proxy configuration**: Apply different proxy settings to different domains
- **Proxy profiles**: Save and reuse proxy configurations
- **HTTP and SOCKS5 support**: Support for both HTTP and SOCKS5 proxy types
- **Authentication support**: Username/password authentication for proxies
- **Tag-based organization**: Organize domains with custom tags
- **Quick toggle**: Enable/disable proxy for domains with one click

## Security and Privacy

This extension is designed with user privacy and security in mind:

### Data Storage
- All configuration data (domains, profiles, proxy settings) is stored locally in the browser using Firefox's `browser.storage.local` API
- Proxy credentials (usernames/passwords) are encrypted and stored only in the local browser storage
- No data is transmitted to external servers or collected by the extension

### Network Permissions
The extension requests the following permissions necessary for its functionality:

- `proxy`: Required to configure and manage proxy settings
- `storage`: Required to save user configuration locally
- `tabs`: Required to determine the current domain when configuring proxy settings
- `activeTab`: Required to access the current tab for configuration
- `webRequest`: Required to handle proxy authentication requests
- `webRequestBlocking`: Required to intercept and modify network requests for proxy routing
- `<all_urls>`: Required to apply proxy settings to any website the user visits

### How Proxy Routing Works
1. When a user visits a website, the extension checks if that domain has proxy configuration
2. If configured, the extension routes the traffic through the specified proxy server
3. If not configured, traffic uses the direct connection (no proxy)
4. Authentication credentials are only used when required by the proxy server and are transmitted securely

### Security Considerations
- **No data collection**: The extension does not collect, store, or transmit any browsing data
- **Local-only storage**: All settings remain on the user's device
- **Transparent operation**: Users can see exactly which domains use which proxies
- **No external dependencies**: The extension works entirely offline once configured

## Installation

1. Download the extension package
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File"
4. Select the downloaded extension file
5. The extension will be installed and ready to use

## Usage

### Basic Setup
1. Click the Proxy Switcher icon in the Firefox toolbar
2. Configure proxy settings for the current domain or access full settings

### Advanced Configuration
1. Right-click the extension icon and select "Options"
2. Add proxy profiles for reuse across domains
3. Configure domain-specific proxy settings
4. Use tags to organize your proxy configurations

## Permissions Explanation

### Required Permissions
- **proxy**: Allows the extension to configure Firefox's proxy settings
- **storage**: Enables saving your proxy configurations locally
- **tabs**: Lets the extension know which domain you're currently viewing
- **activeTab**: Provides access to the currently active tab for configuration
- **webRequest**: Handles authentication with proxy servers
- **webRequestBlocking**: Intercepts and routes network requests through proxies
- **<all_urls>**: Applies proxy settings to any website you visit

All permissions are used solely for proxy management and do not enable data collection or tracking.

## Support

If you encounter issues or have questions:
1. Check that all required permissions are granted
2. Verify your proxy server settings are correct
3. Ensure the proxy server is accessible from your network

## Appearance themes

The extension includes three built-in choices: System, Warm Paper, and Midnight Harbor, plus up to five named custom presets. The appearance selector is in the options page header; the popup remains focused on proxy controls.

Open **Themes…** to create and edit presets. A preset can use one fixed Warm Paper or Midnight Harbor base, or a Light + Dark pair that automatically follows the operating system's `prefers-color-scheme` setting. Creating or editing a preset never switches the selected mode. If the preset being edited is already active, its own colors update immediately. Built-in themes are immutable, and custom color overrides are scoped only to the preset and variant where they were edited.

Use **Export themes** or **Import themes** on the theme editor page to share custom color presets. The JSON file contains only theme presets; proxy domains, profiles, usernames, and passwords are not included. Imports are validated, limited to five presets total, and accept only known semantic color tokens and hexadecimal colors.

Theme settings are stored locally in `browser.storage.local` under `uiThemeSettings` and are shared by the popup and options page. Older theme settings are migrated into the new format when they are read. Warm Paper uses a warm off-white background and muted blue accent. Midnight Harbor uses graphite surfaces with a blue accent reserved for primary actions and focus states.

## Version

Current version: 1.1.0

