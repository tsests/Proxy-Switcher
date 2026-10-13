class OptionsManager {
    constructor() {
        this.currentEditDomain = null;
        this.currentEditProfile = null;
        this.searchQuery = '';
        this.tagFilter = '';
        this.allDomains = {}; // For storing all domains for filtering
        this.init();
    }

    // Sanitizer for user data
    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async init() {
        await this.loadDomains();
        await this.loadProfiles();
        this.setupEventListeners();
    }

    async loadDomains() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getConfig' });
            const config = response.config || { domains: {} };

            this.allDomains = config.domains;
            this.updateTagFilter();
            this.renderDomainsList(this.filterDomains());
        } catch (error) {
            console.error('Failed to load domains:', error);
            this.showError('Failed to load configuration');
        }
    }

    renderDomainsList(domains) {
        const container = document.getElementById('domains-list');
        container.innerHTML = ''; // Clear the container

        if (Object.keys(domains).length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <p>No domains configured yet.</p>
                <p>Click "Add Domain" to get started.</p>
            `;
            container.appendChild(emptyState);
            return;
        }

        const domainsList = Object.entries(domains)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([domain, config]) => this.createDomainCard(domain, config));

        domainsList.forEach(card => {
            container.appendChild(card);
        });
        
        // Add event handlers for buttons
        document.querySelectorAll('.edit-domain').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const domain = e.target.dataset.domain;
                this.editDomain(domain);
            });
        });
        
        document.querySelectorAll('.delete-domain').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const domain = e.target.dataset.domain;
                this.deleteDomain(domain);
            });
        });
    }

    createDomainCard(domain, config) {
        const typeMap = {
            http: 'HTTP',
            socks: 'SOCKS5'
        };

        const statusClass = config.enabled ? 'enabled' : 'disabled';
        const statusText = config.enabled ? 'Enabled' : 'Disabled';

        const card = document.createElement('div');
        card.className = 'domain-card';

        // Header
        const header = document.createElement('div');
        header.className = 'domain-header';

        const headerContent = document.createElement('div');

        const domainName = document.createElement('h3');
        domainName.className = 'domain-name';
        domainName.textContent = this.sanitize(domain);

        headerContent.appendChild(domainName);

        if (config.tags && config.tags.length) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'domain-tags';
            config.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = this.sanitize(tag);
                tagsContainer.appendChild(tagSpan);
            });
            headerContent.appendChild(tagsContainer);
        }

        header.appendChild(headerContent);

        const status = document.createElement('span');
        status.className = `domain-status ${statusClass}`;
        status.textContent = statusText;
        header.appendChild(status);

        card.appendChild(header);

        // Details
        const details = document.createElement('div');
        details.className = 'domain-details';

        const typeDetail = document.createElement('div');
        typeDetail.className = 'detail';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'detail-label';
        typeLabel.textContent = 'Type:';
        const typeValue = document.createElement('span');
        typeValue.className = 'detail-value';
        typeValue.textContent = typeMap[config.type] || config.type;
        typeDetail.appendChild(typeLabel);
        typeDetail.appendChild(typeValue);
        details.appendChild(typeDetail);

        const serverDetail = document.createElement('div');
        serverDetail.className = 'detail';
        const serverLabel = document.createElement('span');
        serverLabel.className = 'detail-label';
        serverLabel.textContent = 'Server:';
        const serverValue = document.createElement('span');
        serverValue.className = 'detail-value';
        serverValue.textContent = `${this.sanitize(config.host)}:${config.port}`;
        serverDetail.appendChild(serverLabel);
        serverDetail.appendChild(serverValue);
        details.appendChild(serverDetail);

        if (config.username) {
            const usernameDetail = document.createElement('div');
            usernameDetail.className = 'detail';
            const usernameLabel = document.createElement('span');
            usernameLabel.className = 'detail-label';
            usernameLabel.textContent = 'Username:';
            const usernameValue = document.createElement('span');
            usernameValue.className = 'detail-value';
            usernameValue.textContent = this.sanitize(config.username);
            usernameDetail.appendChild(usernameLabel);
            usernameDetail.appendChild(usernameValue);
            details.appendChild(usernameDetail);
        }

        card.appendChild(details);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'domain-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary edit-domain';
        editBtn.dataset.domain = domain;
        editBtn.textContent = 'Edit';
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger delete-domain';
        deleteBtn.dataset.domain = domain;
        deleteBtn.textContent = 'Delete';
        actions.appendChild(deleteBtn);

        card.appendChild(actions);

        return card;
    }

    showDomainForm(domain = null, config = null) {
        this.currentEditDomain = domain;

        const formSection = document.getElementById('domain-form-section');
        const formTitle = document.getElementById('form-title');
        const form = document.getElementById('domain-form');
        const overlay = document.getElementById('modal-overlay');

        if (domain) {
            formTitle.textContent = `Edit ${domain}`;
            this.populateForm(config);
        } else {
            formTitle.textContent = 'Add Domain';
            form.reset();
        }

        // Show modal window
        overlay.classList.remove('hidden');
        formSection.classList.remove('hidden');
        document.body.classList.add('modal-open');

        document.getElementById('domain-input').focus();
    }

    hideDomainForm() {
        const formSection = document.getElementById('domain-form-section');
        const overlay = document.getElementById('modal-overlay');

        // Hide modal window
        overlay.classList.add('hidden');
        formSection.classList.add('hidden');
        document.body.classList.remove('modal-open');

        this.currentEditDomain = null;
        const form = document.getElementById('domain-form');
        form.reset();
    }

    populateForm(config) {
        document.getElementById('domain-input').value = this.currentEditDomain;
        document.getElementById('proxy-type').value = config.type || 'http';
        document.getElementById('proxy-host').value = config.host || '';
        document.getElementById('proxy-port').value = config.port || '';
        document.getElementById('proxy-username').value = config.username || '';
        document.getElementById('proxy-password').value = config.password || '';
        document.getElementById('domain-tags').value = config.tags ? config.tags.join(', ') : '';
        document.getElementById('proxy-enabled').checked = config.enabled !== false;
    }

    async saveDomain(event) {
        event.preventDefault();

        const form = event.target;

        // Validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const domain = document.getElementById('domain-input').value.trim().toLowerCase();
        const tagsInput = document.getElementById('domain-tags').value.trim();
        const domainConfig = {
            type: document.getElementById('proxy-type').value,
            host: document.getElementById('proxy-host').value.trim(),
            port: parseInt(document.getElementById('proxy-port').value, 10),
            username: document.getElementById('proxy-username').value.trim() || null,
            password: document.getElementById('proxy-password').value || null,
            enabled: document.getElementById('proxy-enabled').checked,
            tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };

        // Additional validation
        if (domainConfig.port < 1 || domainConfig.port > 65535) {
            this.showError('Port must be between 1 and 65535');
            return;
        }

        try {
            // If domain name has changed, remove the old domain
            if (this.currentEditDomain && this.currentEditDomain !== domain) {
                const removeResponse = await browser.runtime.sendMessage({
                    action: 'removeDomain',
                    domain: this.currentEditDomain
                });
                if (!removeResponse.success) {
                    throw new Error(removeResponse.error || 'Failed to remove old domain');
                }
            }

            // Use centralized API to update domain
            const response = await browser.runtime.sendMessage({
                action: 'updateDomain',
                domain: domain,
                domainConfig: domainConfig
            });

            if (response.success) {
                this.showSuccess(`Domain ${domain} saved successfully`);
                this.hideDomainForm();
                await this.loadDomains();
            } else {
                throw new Error(response.error || 'Failed to save domain');
            }

        } catch (error) {
            console.error('Failed to save domain:', error);
            this.showError('Failed to save domain configuration');
        }
    }

    async deleteDomain(domain) {
        if (!confirm(`Are you sure you want to remove proxy settings for ${domain}?`)) {
            return;
        }

        try {
            // Use centralized API to remove domain
            const response = await browser.runtime.sendMessage({
                action: 'removeDomain',
                domain: domain
            });

            if (response.success) {
                this.showSuccess(`Domain ${domain} removed`);
                await this.loadDomains();
            } else {
                throw new Error(response.error || 'Failed to delete domain');
            }

        } catch (error) {
            console.error('Failed to delete domain:', error);
            this.showError('Failed to delete domain');
        }
    }

    async editDomain(domain) {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getConfig' });
            const config = response.config || { domains: {} };

            if (config.domains[domain]) {
                this.showDomainForm(domain, config.domains[domain]);
            }
        } catch (error) {
            console.error('Failed to load domain:', error);
            this.showError('Failed to load domain configuration');
        }
    }

    // Methods for profiles
    async loadProfiles() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getProfiles' });
            const profiles = response.profiles || {};

            this.renderProfilesList(profiles);
            this.updateProfileSelect(profiles);
        } catch (error) {
            console.error('Failed to load profiles:', error);
            this.showError('Failed to load profiles');
        }
    }

    renderProfilesList(profiles) {
        const container = document.getElementById('profiles-list');
        container.innerHTML = ''; // Clear the container

        if (Object.keys(profiles).length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <p>No profiles configured yet.</p>
                <p>Click "Add Profile" to create your first profile.</p>
            `;
            container.appendChild(emptyState);
            return;
        }

        const profilesList = Object.entries(profiles)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([profileName, config]) => this.createProfileCard(profileName, config));

        profilesList.forEach(card => {
            container.appendChild(card);
        });

        // Add event handlers for buttons
        document.querySelectorAll('.edit-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileName = e.target.dataset.profile;
                this.editProfile(profileName);
            });
        });

        document.querySelectorAll('.delete-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileName = e.target.dataset.profile;
                this.deleteProfile(profileName);
            });
        });
    }

    createProfileCard(profileName, config) {
        const typeMap = {
            http: 'HTTP',
            socks: 'SOCKS5'
        };

        const card = document.createElement('div');
        card.className = 'profile-card';

        // Header
        const header = document.createElement('div');
        header.className = 'profile-header';

        const profileNameEl = document.createElement('h3');
        profileNameEl.className = 'profile-name';
        profileNameEl.textContent = this.sanitize(profileName);

        header.appendChild(profileNameEl);
        card.appendChild(header);

        // Details
        const details = document.createElement('div');
        details.className = 'profile-details';

        const typeDetail = document.createElement('div');
        typeDetail.className = 'detail';
        const typeLabel = document.createElement('span');
        typeLabel.className = 'detail-label';
        typeLabel.textContent = 'Type:';
        const typeValue = document.createElement('span');
        typeValue.className = 'detail-value';
        typeValue.textContent = typeMap[config.type] || config.type;
        typeDetail.appendChild(typeLabel);
        typeDetail.appendChild(typeValue);
        details.appendChild(typeDetail);

        const serverDetail = document.createElement('div');
        serverDetail.className = 'detail';
        const serverLabel = document.createElement('span');
        serverLabel.className = 'detail-label';
        serverLabel.textContent = 'Server:';
        const serverValue = document.createElement('span');
        serverValue.className = 'detail-value';
        serverValue.textContent = `${this.sanitize(config.host)}:${config.port}`;
        serverDetail.appendChild(serverLabel);
        serverDetail.appendChild(serverValue);
        details.appendChild(serverDetail);

        if (config.username) {
            const usernameDetail = document.createElement('div');
            usernameDetail.className = 'detail';
            const usernameLabel = document.createElement('span');
            usernameLabel.className = 'detail-label';
            usernameLabel.textContent = 'Username:';
            const usernameValue = document.createElement('span');
            usernameValue.className = 'detail-value';
            usernameValue.textContent = this.sanitize(config.username);
            usernameDetail.appendChild(usernameLabel);
            usernameDetail.appendChild(usernameValue);
            details.appendChild(usernameDetail);
        }

        card.appendChild(details);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'profile-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary edit-profile';
        editBtn.dataset.profile = profileName;
        editBtn.textContent = 'Edit';
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger delete-profile';
        deleteBtn.dataset.profile = profileName;
        deleteBtn.textContent = 'Delete';
        actions.appendChild(deleteBtn);

        card.appendChild(actions);

        return card;
    }

    updateProfileSelect(profiles) {
        const select = document.getElementById('profile-select');
        const currentValue = select.value;

        // Clear the select, keeping only the default option
        select.innerHTML = '<option value="">-- Select Profile --</option>';

        // Add profiles
        Object.keys(profiles).sort().forEach(profileName => {
            const option = document.createElement('option');
            option.value = profileName;
            option.textContent = profileName;
            select.appendChild(option);
        });

        // Restore selected value if it still exists
        if (currentValue && profiles[currentValue]) {
            select.value = currentValue;
        }
    }

    showProfileForm(profileName = null, config = null) {
        this.currentEditProfile = profileName;

        const formSection = document.getElementById('profile-form-section');
        const formTitle = document.getElementById('profile-form-title');
        const form = document.getElementById('profile-form');
        const overlay = document.getElementById('modal-overlay');

        if (profileName) {
            formTitle.textContent = `Edit ${profileName}`;
            this.populateProfileForm(config);
        } else {
            formTitle.textContent = 'Add Profile';
            form.reset();
        }

        // Show modal window
        overlay.classList.remove('hidden');
        formSection.classList.remove('hidden');
        document.body.classList.add('modal-open');

        document.getElementById('profile-name-input').focus();
    }

    hideProfileForm() {
        const formSection = document.getElementById('profile-form-section');
        const overlay = document.getElementById('modal-overlay');

        // Hide modal window
        overlay.classList.add('hidden');
        formSection.classList.add('hidden');
        document.body.classList.remove('modal-open');

        this.currentEditProfile = null;
        const form = document.getElementById('profile-form');
        form.reset();
    }

    populateProfileForm(config) {
        document.getElementById('profile-name-input').value = this.currentEditProfile;
        document.getElementById('profile-proxy-type').value = config.type || 'http';
        document.getElementById('profile-proxy-host').value = config.host || '';
        document.getElementById('profile-proxy-port').value = config.port || '';
        document.getElementById('profile-proxy-username').value = config.username || '';
        document.getElementById('profile-proxy-password').value = config.password || '';
    }

    async saveProfile(event) {
        event.preventDefault();

        const form = event.target;

        // Validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const profileName = document.getElementById('profile-name-input').value.trim();
        const profileConfig = {
            type: document.getElementById('profile-proxy-type').value,
            host: document.getElementById('profile-proxy-host').value.trim(),
            port: parseInt(document.getElementById('profile-proxy-port').value, 10),
            username: document.getElementById('profile-proxy-username').value.trim() || null,
            password: document.getElementById('profile-proxy-password').value || null
        };

        // Additional validation
        if (profileConfig.port < 1 || profileConfig.port > 65535) {
            this.showError('Port must be between 1 and 65535');
            return;
        }

        try {
            // If profile name has changed, remove the old profile
            if (this.currentEditProfile && this.currentEditProfile !== profileName) {
                const removeResponse = await browser.runtime.sendMessage({
                    action: 'removeProfile',
                    profileName: this.currentEditProfile
                });
                if (!removeResponse.success) {
                    throw new Error(removeResponse.error || 'Failed to remove old profile');
                }
            }

            const response = await browser.runtime.sendMessage({
                action: 'updateProfile',
                profileName: profileName,
                profileConfig: profileConfig
            });

            if (response.success) {
                this.showSuccess(`Profile "${profileName}" saved successfully`);
                this.hideProfileForm();
                await this.loadProfiles();
            } else {
                throw new Error(response.error || 'Failed to save profile');
            }

        } catch (error) {
            console.error('Failed to save profile:', error);
            this.showError('Failed to save profile');
        }
    }

    async deleteProfile(profileName) {
        if (!confirm(`Are you sure you want to delete profile "${profileName}"?`)) {
            return;
        }

        try {
            const response = await browser.runtime.sendMessage({
                action: 'removeProfile',
                profileName: profileName
            });

            if (response.success) {
                this.showSuccess(`Profile "${profileName}" deleted`);
                await this.loadProfiles();
            } else {
                throw new Error(response.error || 'Failed to delete profile');
            }

        } catch (error) {
            console.error('Failed to delete profile:', error);
            this.showError('Failed to delete profile');
        }
    }

    async editProfile(profileName) {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getProfile', profileName });
            const profile = response.profile;

            if (profile) {
                this.showProfileForm(profileName, profile);
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.showError('Failed to load profile');
        }
    }

    // Fill domain form with profile data
    fillFormFromProfile(profileName) {
        if (!profileName) {
            // If empty profile is selected, do nothing
            return;
        }

        // Get profile data
        browser.runtime.sendMessage({ action: 'getProfile', profileName })
            .then(response => {
                const profile = response.profile;
                if (profile) {
                    // Fill domain form fields
                    document.getElementById('proxy-type').value = profile.type || 'http';
                    document.getElementById('proxy-host').value = profile.host || '';
                    document.getElementById('proxy-port').value = profile.port || '';
                    document.getElementById('proxy-username').value = profile.username || '';
                    document.getElementById('proxy-password').value = profile.password || '';
                }
            })
            .catch(error => {
                console.error('Failed to load profile for form:', error);
            });
    }

    // Filter domains by search and tags
    filterDomains() {
        let filtered = { ...this.allDomains };

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = Object.fromEntries(
                Object.entries(filtered).filter(([domain]) =>
                    domain.toLowerCase().includes(query)
                )
            );
        }

        // Tag filter
        if (this.tagFilter) {
            filtered = Object.fromEntries(
                Object.entries(filtered).filter(([, config]) =>
                    config.tags && config.tags.includes(this.tagFilter)
                )
            );
        }

        return filtered;
    }

    // Update tag filter
    updateTagFilter() {
        const tagFilter = document.getElementById('tag-filter');
        const currentValue = tagFilter.value;

        // Collect all unique tags
        const allTags = new Set();
        Object.values(this.allDomains).forEach(config => {
            if (config.tags) {
                config.tags.forEach(tag => allTags.add(tag));
            }
        });

        // Clear and add options
        tagFilter.innerHTML = '<option value="">All tags</option>';
        Array.from(allTags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });

        // Restore selected value
        if (currentValue && allTags.has(currentValue)) {
            tagFilter.value = currentValue;
        }
    }

    // Update domain display when filters change
    updateDomainDisplay() {
        this.renderDomainsList(this.filterDomains());
    }

    // Methods for bulk deletion
    async clearAllDomains() {
        if (!confirm('Are you sure you want to delete ALL domain configurations? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await browser.runtime.sendMessage({ action: 'clearAllDomains' });
            if (response.success) {
                this.showSuccess('All domains cleared');
                await this.loadDomains();
            } else {
                throw new Error(response.error || 'Failed to clear domains');
            }
        } catch (error) {
            console.error('Failed to clear domains:', error);
            this.showError('Failed to clear domains');
        }
    }

    async clearAllProfiles() {
        if (!confirm('Are you sure you want to delete ALL profile configurations? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await browser.runtime.sendMessage({ action: 'clearAllProfiles' });
            if (response.success) {
                this.showSuccess('All profiles cleared');
                await this.loadProfiles();
            } else {
                throw new Error(response.error || 'Failed to clear profiles');
            }
        } catch (error) {
            console.error('Failed to clear profiles:', error);
            this.showError('Failed to clear profiles');
        }
    }

    async clearEverything() {
        if (!confirm('Are you sure you want to delete ALL configurations (domains and profiles)? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await browser.runtime.sendMessage({ action: 'clearEverything' });
            if (response.success) {
                this.showSuccess('All configurations cleared');
                await this.loadDomains();
                await this.loadProfiles();
            } else {
                throw new Error(response.error || 'Failed to clear everything');
            }
        } catch (error) {
            console.error('Failed to clear everything:', error);
            this.showError('Failed to clear everything');
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'success') {
            messageDiv.style.backgroundColor = 'var(--color-success)';
        } else if (type === 'error') {
            messageDiv.style.backgroundColor = 'var(--color-danger)';
        } else {
            messageDiv.style.backgroundColor = 'var(--color-info)';
        }
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageDiv.remove(), 300);
        }, 3000);
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    setupEventListeners() {
        // Modal overlay - close on click
        document.getElementById('modal-overlay').addEventListener('click', () => {
            // Determine which form is open
            const domainForm = document.getElementById('domain-form-section');
            const profileForm = document.getElementById('profile-form-section');

            if (!domainForm.classList.contains('hidden')) {
                this.hideDomainForm();
            } else if (!profileForm.classList.contains('hidden')) {
                this.hideProfileForm();
            }
        });

        // Add domain
        document.getElementById('add-domain').addEventListener('click', () => {
            this.showDomainForm();
        });

        // Domain form
        document.getElementById('domain-form').addEventListener('submit',
            (e) => this.saveDomain(e));

        // Cancel editing
        document.getElementById('cancel-form').addEventListener('click', () => {
            this.hideDomainForm();
        });

        // Show/hide password
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                const input = document.getElementById(targetId);
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                e.target.textContent = type === 'password' ? '👁' : '👁️‍🗨️';
            });
        });

        // Profiles
        document.getElementById('add-profile').addEventListener('click', () => {
            this.showProfileForm();
        });

        document.getElementById('profile-form').addEventListener('submit',
            (e) => this.saveProfile(e));

        document.getElementById('cancel-profile-form').addEventListener('click', () => {
            this.hideProfileForm();
        });

        // Fill domain form from profile
        document.getElementById('profile-select').addEventListener('change', (e) => {
            this.fillFormFromProfile(e.target.value);
        });

        // Domain search
        document.getElementById('domain-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.updateDomainDisplay();
        });

        // Tag filter
        document.getElementById('tag-filter').addEventListener('change', (e) => {
            this.tagFilter = e.target.value;
            this.updateDomainDisplay();
        });

        // Control buttons
        document.getElementById('clear-domains').addEventListener('click', () => {
            this.clearAllDomains();
        });

        document.getElementById('clear-profiles').addEventListener('click', () => {
            this.clearAllProfiles();
        });

        document.getElementById('clear-all').addEventListener('click', () => {
            this.clearEverything();
        });
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});
