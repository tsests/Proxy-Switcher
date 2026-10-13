// Global configuration reference for backward compatibility
// configManager is available via window.configManager from config-manager.js
let config = window.configManager.getConfig();

// Initialization
async function init() {
  await configManager.load();
  config = configManager.getConfig(); // Update global reference
  setupProxyListener();

  // Subscribe to configuration changes
  configManager.addListener((event, data) => {
    config = configManager.getConfig(); // Update global reference
  });
}

// Setup proxy listener
// SECURITY NOTE: The extension only routes traffic through user-configured proxies.
// No data is collected or transmitted externally. All proxy settings are user-controlled.
function setupProxyListener() {
  // Listen for all URLs to apply domain-specific proxy routing
  // This permission is required but only routes traffic through user-specified proxies
  browser.proxy.onRequest.addListener(
    handleProxyRequest,
    { urls: ["<all_urls>"] }
  );

  // Listener for automatic proxy authentication
  // SECURITY NOTE: Credentials are only used for proxy authentication and stored locally
  browser.webRequest.onAuthRequired.addListener(
    handleAuthRequired,
    { urls: ["<all_urls>"] },
    ["blocking"]
  );

  // Track tabs to determine origin domain for proxy configuration
  // SECURITY NOTE: Only tracks domain names, no URL content or personal data
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      updateTabOrigin(tabId, tab.url);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    delete config.activeTabs[tabId];
  });
}

// Extract domain from URL
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

// Determine origin for tab
function updateTabOrigin(tabId, url) {
  const domain = getDomainFromUrl(url);
  if (domain) {
    config.activeTabs[tabId] = domain;
  }
}

// Get proxy settings for domain
function getProxyConfigForDomain(domain) {
  return config.domains[domain];
}

// Proxy request handler
function handleProxyRequest(requestInfo) {
  const { tabId, url, originUrl, type } = requestInfo;

  // Determine request domain
  let domain;

  if (originUrl) {
    // For sub-requests use origin
    domain = getDomainFromUrl(originUrl);
  } else if (tabId in config.activeTabs) {
    // For main requests use stored tab origin
    domain = config.activeTabs[tabId];
  } else {
    // Fallback option
    domain = getDomainFromUrl(url);
  }

  if (!domain) {
    return { type: 'direct' };
  }

  // Check domain configuration
  const proxyConfig = getProxyConfigForDomain(domain);

  if (!proxyConfig || !proxyConfig.enabled) {
    return { type: 'direct' };
  }

  // Form proxy object
  const proxyObj = {
    type: proxyConfig.type,
    host: proxyConfig.host,
    port: parseInt(proxyConfig.port, 10)
  };

  // Add authentication if present
  if (proxyConfig.username) {
    proxyObj.username = proxyConfig.username;
  }

  if (proxyConfig.password) {
    proxyObj.password = proxyConfig.password;
  }

  return proxyObj;
}

// Authentication request handler
function handleAuthRequired(details) {
  const { url, originUrl, tabId, isProxy, realm } = details;

  // Process only proxy authentication
  if (!isProxy) {
    return {};
  }

  // Determine request domain
  let domain;

  if (originUrl) {
    domain = getDomainFromUrl(originUrl);
  } else if (tabId in config.activeTabs) {
    domain = config.activeTabs[tabId];
  } else {
    domain = getDomainFromUrl(url);
  }

  if (!domain) {
    return {};
  }

  // Get proxy configuration for domain
  const proxyConfig = getProxyConfigForDomain(domain);

  if (!proxyConfig || !proxyConfig.enabled || !proxyConfig.username || !proxyConfig.password) {
    return {};
  }

  // Return credentials for authentication
  return {
    authCredentials: {
      username: proxyConfig.username,
      password: proxyConfig.password
    }
  };
}

// Message handler from other extension parts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getConfig') {
    sendResponse({ config: configManager.getConfig() });
  } else if (message.action === 'updateDomain') {
    configManager.updateDomain(message.domain, message.domainConfig)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.action === 'removeDomain') {
    configManager.removeDomain(message.domain)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.action === 'toggleProxy') {
    // Quick enable/disable proxy for domain
    const domain = message.domain;
    const enabled = message.enabled;
    const domainConfig = configManager.getDomainConfig(domain);

    if (domainConfig) {
      // If domain is already configured, just change enabled
      domainConfig.enabled = enabled;
      configManager.updateDomain(domain, domainConfig)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      // If domain is not configured, send error
      sendResponse({ success: false, error: 'Domain not configured' });
    }
    return true; // Async response
  } else if (message.action === 'reloadConfig') {
    configManager.reload()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.action === 'getProfiles') {
    sendResponse({ profiles: configManager.getProfiles() });
  } else if (message.action === 'updateProfile') {
    configManager.updateProfile(message.profileName, message.profileConfig)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.action === 'removeProfile') {
    configManager.removeProfile(message.profileName)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.action === 'getProfile') {
    sendResponse({ profile: configManager.getProfileConfig(message.profileName) });
  } else if (message.action === 'clearAllDomains') {
    configManager.config.domains = {};
    configManager.save()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.action === 'clearAllProfiles') {
    configManager.config.profiles = {};
    configManager.save()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (message.action === 'clearEverything') {
    configManager.config.domains = {};
    configManager.config.profiles = {};
    configManager.save()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Initialization on load
init();
