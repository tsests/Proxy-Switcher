class PopupManager {
    constructor() {
        this.currentTab = null;
        this.currentDomain = null;
        this.currentConfig = null;
        this.init();
    }

    async init() {
        await this.loadCurrentTab();
        await this.loadConfig();
        await this.loadProfiles();
        this.setupUI();
        this.setupEventListeners();
    }

    async loadCurrentTab() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            if (this.currentTab.url) {
                this.currentDomain = this.extractDomain(this.currentTab.url);
                document.getElementById('current-domain').textContent = this.currentDomain;
            }
        } catch (error) {
            console.error('Failed to load current tab:', error);
            document.getElementById('current-domain').textContent = 'Unknown domain';
        }
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            return null;
        }
    }

    async loadConfig() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getConfig' });
            const config = response.config || { domains: {} };
            this.currentConfig = config;

            if (this.currentDomain && config.domains[this.currentDomain]) {
                this.currentConfig = config.domains[this.currentDomain];
            }
        } catch (error) {
            console.error('Failed to load config:', error);
            this.currentConfig = null;
        }
    }

    async loadProfiles() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getProfiles' });
            const profiles = response.profiles || {};
            this.updateProfileSelect(profiles);
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    }

    updateProfileSelect(profiles) {
        const select = document.getElementById('popup-profile-select');

        // Clear select, keeping only default option
        select.innerHTML = '<option value="">-- Select Profile --</option>';

        // Add profiles
        Object.keys(profiles).sort().forEach(profileName => {
            const option = document.createElement('option');
            option.value = profileName;
            option.textContent = profileName;
            select.appendChild(option);
        });
    }

    // Fill form with profile data
    fillFormFromProfile(profileName) {
        if (!profileName) {
            // If empty profile selected, do nothing
            return;
        }

        // Get profile data
        browser.runtime.sendMessage({ action: 'getProfile', profileName })
            .then(response => {
                const profile = response.profile;
                if (profile) {
                    // Fill form fields
                    document.getElementById('popup-proxy-type').value = profile.type || 'http';
                    document.getElementById('popup-proxy-host').value = profile.host || '';
                    document.getElementById('popup-proxy-port').value = profile.port || '';
                    document.getElementById('popup-proxy-username').value = profile.username || '';
                    document.getElementById('popup-proxy-password').value = profile.password || '';
                }
            })
            .catch(error => {
                console.error('Failed to load profile for form:', error);
            });
    }

    setupUI() {
        const enableCheckbox = document.getElementById('enable-proxy');
        const proxyForm = document.getElementById('proxy-form');
        const noProxyInfo = document.getElementById('no-proxy-info');

        if (this.currentConfig) {
            // Proxy configured for this domain
            enableCheckbox.checked = this.currentConfig.enabled !== false;
            enableCheckbox.disabled = false;
            // Show/hide form based on checkbox state
            this.updateFormVisibility(enableCheckbox.checked);
            noProxyInfo.classList.add('hidden');

            // Populate form
            this.populateForm();
        } else {
            // Proxy not configured
            enableCheckbox.checked = false;
            enableCheckbox.disabled = true; // Disable checkbox if domain not configured
            proxyForm.classList.add('hidden');
            noProxyInfo.classList.remove('hidden');
        }
    }

    updateFormVisibility(showForm) {
        const proxyForm = document.getElementById('proxy-form');
        proxyForm.classList.toggle('hidden', !showForm);
    }

    populateForm() {
        if (!this.currentConfig) return;
        
        document.getElementById('popup-proxy-type').value = this.currentConfig.type || 'http';
        document.getElementById('popup-proxy-host').value = this.currentConfig.host || '';
        document.getElementById('popup-proxy-port').value = this.currentConfig.port || '';
        document.getElementById('popup-proxy-username').value = this.currentConfig.username || '';
        document.getElementById('popup-proxy-password').value = this.currentConfig.password || '';
    }

    async saveConfig() {
        if (!this.currentDomain) return;

        // Collect form data
        const domainConfig = {
            type: document.getElementById('popup-proxy-type').value,
            host: document.getElementById('popup-proxy-host').value.trim(),
            port: parseInt(document.getElementById('popup-proxy-port').value, 10),
            username: document.getElementById('popup-proxy-username').value.trim() || null,
            password: document.getElementById('popup-proxy-password').value || null,
            enabled: document.getElementById('enable-proxy').checked
        };

        // Validation
        if (!domainConfig.host || !domainConfig.port) {
            this.showError('Host and port are required');
            return false;
        }

        if (domainConfig.port < 1 || domainConfig.port > 65535) {
            this.showError('Port must be between 1 and 65535');
            return false;
        }

        try {
            // Use centralized API for domain update
            const response = await browser.runtime.sendMessage({
                action: 'updateDomain',
                domain: this.currentDomain,
                domainConfig: domainConfig
            });

            return response.success;
        } catch (error) {
            console.error('Failed to save config:', error);
            this.showError('Failed to save configuration');
            return false;
        }
    }

    async removeDomainConfig() {
        try {
            // Use centralized API for domain removal
            const response = await browser.runtime.sendMessage({
                action: 'removeDomain',
                domain: this.currentDomain
            });

            return response.success;
        } catch (error) {
            console.error('Failed to remove config:', error);
            return false;
        }
    }

    async toggleProxy(enabled) {
        if (!this.currentDomain) return;

        try {
            const response = await browser.runtime.sendMessage({
                action: 'toggleProxy',
                domain: this.currentDomain,
                enabled: enabled
            });

            if (!response.success) {
                // If domain not configured, show message
                this.showError('Domain not configured. Use "Apply & Reload" to configure proxy first.');
                // Return checkbox to previous state
                document.getElementById('enable-proxy').checked = !enabled;
            }
        } catch (error) {
            console.error('Failed to toggle proxy:', error);
            this.showError('Failed to toggle proxy');
            // Return checkbox to previous state
            document.getElementById('enable-proxy').checked = !enabled;
        }
    }

    async applyAndReload() {
        const success = await this.saveConfig();

        if (success && this.currentTab) {
            // Reload tab
            await browser.tabs.reload(this.currentTab.id);

            // Close popup
            window.close();
        }
    }

    showError(message) {
        // Simple error display implementation
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            background-color: #f8d7da;
            color: #721c24;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            border: 1px solid #f5c6cb;
        `;

        const main = document.querySelector('.popup-main');
        main.insertBefore(errorDiv, main.firstChild);

        setTimeout(() => errorDiv.remove(), 3000);
    }

    setupEventListeners() {
        // Proxy toggle (quick enable/disable)
        document.getElementById('enable-proxy').addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            this.updateFormVisibility(enabled); // Show/hide form
            await this.toggleProxy(enabled);
        });

        // Apply settings
        document.getElementById('apply-proxy').addEventListener('click', () => {
            this.applyAndReload();
        });

        // Open settings
        document.getElementById('open-options').addEventListener('click', () => {
            browser.runtime.openOptionsPage();
            window.close();
        });

        // Show/hide password
        document.querySelector('.toggle-password').addEventListener('click', (e) => {
            const input = document.getElementById('popup-proxy-password');
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            e.target.textContent = type === 'password' ? '👁' : '👁️‍🗨️';
        });

        // Handle Enter in form
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyAndReload();
                }
            });
        });

        // Fill form from profile
        document.getElementById('popup-profile-select').addEventListener('change', (e) => {
            this.fillFormFromProfile(e.target.value);
        });
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
