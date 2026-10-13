// Centralized configuration manager for Firefox Proxy Switcher

// Default configuration
const DEFAULT_CONFIG = {
  domains: {},
  profiles: {}, // profileName -> profileConfig
  activeTabs: {} // tabId -> domain for tracking active tabs
};

// Centralized configuration manager
class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.listeners = [];
  }

  // Load configuration from storage
  // SECURITY NOTE: Data is stored locally only, never transmitted externally
  async load() {
    try {
      const stored = await browser.storage.local.get('config');
      this.config = { ...DEFAULT_CONFIG, ...stored.config };

      this.notifyListeners('loaded');
      return this.config;
    } catch (error) {
      console.error('Failed to load config:', error);
      throw error;
    }
  }

  // Save configuration to storage
  // SECURITY NOTE: All proxy credentials and settings remain on user's device
  async save() {
    try {
      await browser.storage.local.set({ config: this.config });

      this.notifyListeners('saved');
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  // Reload configuration
  async reload() {
    return await this.load();
  }

  // Get current configuration
  getConfig() {
    return { ...this.config };
  }

  // Update domain
  async updateDomain(domain, domainConfig) {
    // Ensure tags is an array of strings
    if (domainConfig.tags && typeof domainConfig.tags === 'string') {
      domainConfig.tags = domainConfig.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    } else if (!domainConfig.tags) {
      domainConfig.tags = [];
    }
    this.config.domains[domain] = domainConfig;
    await this.save();
    this.notifyListeners('domainUpdated', { domain, config: domainConfig });
  }

  // Remove domain
  async removeDomain(domain) {
    if (this.config.domains[domain]) {
      delete this.config.domains[domain];
      await this.save();
      this.notifyListeners('domainRemoved', { domain });
    }
  }

  // Get domain configuration
  getDomainConfig(domain) {
    return this.config.domains[domain] || null;
  }

  // Update profile
  async updateProfile(profileName, profileConfig) {
    this.config.profiles[profileName] = profileConfig;
    await this.save();
    this.notifyListeners('profileUpdated', { profileName, config: profileConfig });
  }

  // Remove profile
  async removeProfile(profileName) {
    if (this.config.profiles[profileName]) {
      delete this.config.profiles[profileName];
      await this.save();
      this.notifyListeners('profileRemoved', { profileName });
    }
  }

  // Get profile configuration
  getProfileConfig(profileName) {
    return this.config.profiles[profileName] || null;
  }

  // Get all profiles
  getProfiles() {
    return { ...this.config.profiles };
  }

  // Add change listener
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Notify listeners
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in config listener:', error);
      }
    });
  }
}

// Create global instance of configuration manager
const configManager = new ConfigManager();

// Create global variable for use in other scripts
window.ConfigManager = ConfigManager;
window.configManager = configManager;
window.DEFAULT_CONFIG = DEFAULT_CONFIG;
