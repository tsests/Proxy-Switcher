document.addEventListener('DOMContentLoaded', async () => {
  const api = window.ProxySwitcherTheme;
  if (!api) return;

  const element = id => document.getElementById(id);
  const controls = element('color-controls');
  const status = element('editor-status');
  const createForm = element('create-preset-form');
  const createType = element('new-preset-type');
  const createBaseField = element('new-preset-base-field');
  const presetList = element('preset-list');
  const selectedPanel = element('selected-preset-panel');
  const variantTabs = element('variant-tabs');
  let settings = await api.getSettings();
  let selectedPresetId = settings.presets[0] ? settings.presets[0].id : null;
  let activeVariant = 'light';

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  }

  function getSelectedPreset(source = settings) {
    return source.presets.find(preset => preset.id === selectedPresetId) || null;
  }

  async function save(nextSettings, message) {
    settings = api.normalizeSettings(nextSettings);
    await browser.storage.local.set({ [api.storageKey]: settings });
    render();
    if (message) setStatus(message);
  }

  function colorToHex(value, fallback = '#888888') {
    if (typeof value !== 'string') return fallback;
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
    const rgb = value.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (!rgb) return fallback;
    const channels = rgb.slice(1, 4).map(channel => Math.min(255, Number(channel)));
    return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }

  function getVariantState(preset) {
    if (!preset) return null;
    if (preset.type === 'single') {
      const base = preset.base === 'dark' ? 'dark' : 'light';
      return {
        variant: base,
        baseName: base === 'dark' ? 'harbor' : 'warm',
        overrides: preset.overrides,
        label: base === 'dark' ? 'Midnight Harbor colors' : 'Warm Paper colors'
      };
    }
    const variant = activeVariant === 'dark' ? 'dark' : 'light';
    return {
      variant,
      baseName: variant === 'dark' ? 'harbor' : 'warm',
      overrides: variant === 'dark' ? preset.darkOverrides : preset.lightOverrides,
      label: variant === 'dark' ? 'Dark variant colors' : 'Light variant colors'
    };
  }

  function renderPreview(preset, settingsForPreview = settings) {
    if (!preset) return;
    const previewSettings = api.normalizeSettings(settingsForPreview);
    previewSettings.mode = `preset:${preset.id}`;
    const resolved = api.resolvePalette(previewSettings, activeVariant === 'dark');
    const preview = element('theme-preview');
    for (const [key, value] of Object.entries(resolved.palette)) {
      preview.style.setProperty(`--preview-${key}`, value);
    }
  }

  function renderPresetCards() {
    presetList.replaceChildren();
    element('preset-count').textContent = `${settings.presets.length} / ${api.maxPresets}`;
    const isFull = settings.presets.length >= api.maxPresets;
    element('create-preset').disabled = isFull;
    element('new-preset-name').disabled = isFull;
    createType.disabled = isFull;
    element('new-preset-base').disabled = isFull || createType.value === 'pair';

    for (const preset of settings.presets) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'preset-card';
      card.setAttribute('aria-pressed', String(preset.id === selectedPresetId));
      const swatches = document.createElement('span');
      swatches.className = 'preset-swatches';
      const lightSwatch = document.createElement('span');
      lightSwatch.className = 'preset-swatch light';
      const darkSwatch = document.createElement('span');
      darkSwatch.className = 'preset-swatch dark';
      if (preset.type === 'pair') {
        swatches.append(lightSwatch, darkSwatch);
      } else {
        const swatch = preset.base === 'dark' ? darkSwatch : lightSwatch;
        swatches.appendChild(swatch);
      }
      const copy = document.createElement('span');
      copy.className = 'preset-card-copy';
      const name = document.createElement('span');
      name.className = 'preset-card-name';
      name.textContent = preset.name;
      const type = document.createElement('span');
      type.className = 'preset-card-type';
      type.textContent = preset.type === 'pair' ? 'Light + dark pair' : `Single · ${preset.base === 'dark' ? 'Midnight Harbor' : 'Warm Paper'}`;
      if (settings.mode === `preset:${preset.id}`) type.textContent += ' · Active';
      copy.append(name, type);
      card.append(swatches, copy);
      card.addEventListener('click', () => {
        selectedPresetId = preset.id;
        activeVariant = preset.type === 'single' ? preset.base : 'light';
        render();
      });
      presetList.appendChild(card);
    }

    element('empty-presets').hidden = settings.presets.length > 0;
  }

  function renderColorControls(preset) {
    controls.replaceChildren();
    const state = getVariantState(preset);
    if (!state) return;
    const basePalette = api.themes[state.baseName];
    element('color-editor-title').textContent = state.label;

    for (const [key, labelText] of Object.entries(api.tokenLabels)) {
      const row = document.createElement('div');
      row.className = 'color-control';
      const valueWrap = document.createElement('div');
      valueWrap.className = 'color-value';
      const label = document.createElement('label');
      label.htmlFor = `color-${key}`;
      label.textContent = labelText;
      const code = document.createElement('code');
      code.textContent = key;
      valueWrap.append(label, code);

      const input = document.createElement('input');
      input.type = 'color';
      input.id = `color-${key}`;
      input.value = colorToHex(state.overrides[key] || basePalette[key]);
      input.setAttribute('aria-label', labelText);
      input.addEventListener('input', () => {
        const previewSettings = api.normalizeSettings(settings);
        const target = previewSettings.presets.find(item => item.id === selectedPresetId);
        if (!target) return;
        if (target.type === 'single') target.overrides[key] = input.value.toUpperCase();
        else if (activeVariant === 'dark') target.darkOverrides[key] = input.value.toUpperCase();
        else target.lightOverrides[key] = input.value.toUpperCase();
        renderPreview(target, previewSettings);
      });
      input.addEventListener('change', async () => {
        try {
          const latest = await api.getSettings();
          const target = latest.presets.find(item => item.id === selectedPresetId);
          if (!target) throw new Error('The selected preset no longer exists.');
          if (target.type === 'single') {
            target.overrides[key] = input.value.toUpperCase();
          } else if (activeVariant === 'dark') {
            target.darkOverrides[key] = input.value.toUpperCase();
          } else {
            target.lightOverrides[key] = input.value.toUpperCase();
          }
          await save(latest, 'Color saved.');
        } catch (error) {
          setStatus(error.message || 'Could not save this color.', true);
        }
      });
      row.append(valueWrap, input);
      controls.appendChild(row);
    }
  }

  function renderSelectedPreset() {
    const preset = getSelectedPreset();
    selectedPanel.hidden = !preset;
    if (!preset) return;

    element('selected-preset-title').textContent = preset.name;
    element('selected-preset-description').textContent = preset.type === 'pair'
      ? 'This preset switches between its own light and dark variants with your system appearance.'
      : 'This preset always uses its selected base palette, regardless of system appearance.';
    element('preset-name').value = preset.name;
    element('editor-base-theme').value = preset.base || 'light';
    const isPair = preset.type === 'pair';
    variantTabs.hidden = !isPair;
    element('single-preset-base-row').hidden = isPair;
    if (isPair) {
      for (const button of variantTabs.querySelectorAll('[data-variant]')) {
        button.classList.toggle('is-selected', button.dataset.variant === activeVariant);
        button.setAttribute('aria-pressed', String(button.dataset.variant === activeVariant));
      }
    } else {
      activeVariant = preset.base || 'light';
    }
    element('activate-preset').textContent = settings.mode === `preset:${preset.id}` ? 'Currently active' : 'Use this theme';
    element('activate-preset').disabled = settings.mode === `preset:${preset.id}`;
    renderPreview(preset);
    renderColorControls(preset);
  }

  function render() {
    renderPresetCards();
    renderSelectedPreset();
  }

  createType.addEventListener('change', () => {
    createBaseField.hidden = createType.value === 'pair';
    element('new-preset-base').disabled = createType.value === 'pair';
  });

  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const latest = await api.getSettings();
      const next = api.createPreset(latest, {
        name: element('new-preset-name').value,
        type: createType.value,
        base: element('new-preset-base').value
      });
      const created = next.presets[next.presets.length - 1];
      selectedPresetId = created.id;
      activeVariant = created.type === 'single' ? created.base : 'light';
      await save(next, 'Preset created. It has not been activated.');
      element('new-preset-name').value = '';
    } catch (error) {
      setStatus(error.message || 'Could not create the preset.', true);
    }
  });

  element('rename-preset').addEventListener('click', async () => {
    try {
      const latest = await api.getSettings();
      const next = api.renamePreset(latest, selectedPresetId, element('preset-name').value);
      await save(next, 'Preset renamed.');
    } catch (error) {
      setStatus(error.message || 'Could not rename the preset.', true);
    }
  });

  element('delete-preset').addEventListener('click', async () => {
    const selected = getSelectedPreset();
    if (!selected) return;
    if (typeof window.confirm === 'function' && !window.confirm(`Delete the preset "${selected.name}"?`)) return;
    try {
      const latest = await api.getSettings();
      const next = api.deletePreset(latest, selectedPresetId);
      selectedPresetId = next.presets[0] ? next.presets[0].id : null;
      const remaining = getSelectedPreset(next);
      activeVariant = remaining && remaining.type === 'single' ? remaining.base : 'light';
      await save(next, 'Preset deleted.');
    } catch (error) {
      setStatus(error.message || 'Could not delete the preset.', true);
    }
  });

  element('activate-preset').addEventListener('click', async () => {
    if (!getSelectedPreset()) return;
    try {
      const latest = await api.getSettings();
      if (!latest.presets.some(preset => preset.id === selectedPresetId)) throw new Error('The selected preset no longer exists.');
      await save({ ...latest, mode: `preset:${selectedPresetId}` }, 'Preset activated.');
    } catch (error) {
      setStatus(error.message || 'Could not activate the preset.', true);
    }
  });

  element('editor-base-theme').addEventListener('change', async event => {
    try {
      const latest = await api.getSettings();
      const target = latest.presets.find(preset => preset.id === selectedPresetId);
      if (!target || target.type !== 'single') return;
      target.base = event.target.value === 'dark' ? 'dark' : 'light';
      activeVariant = target.base;
      await save(latest, 'Base palette updated.');
    } catch (error) {
      setStatus(error.message || 'Could not change the base palette.', true);
    }
  });

  for (const button of variantTabs.querySelectorAll('[data-variant]')) {
    button.addEventListener('click', () => {
      activeVariant = button.dataset.variant === 'dark' ? 'dark' : 'light';
      renderSelectedPreset();
    });
  }

  element('reset-variant-colors').addEventListener('click', async () => {
    try {
      const latest = await api.getSettings();
      const target = latest.presets.find(preset => preset.id === selectedPresetId);
      if (!target) return;
      if (target.type === 'single') target.overrides = {};
      else if (activeVariant === 'dark') target.darkOverrides = {};
      else target.lightOverrides = {};
      await save(latest, 'Colors reset to the base palette.');
    } catch (error) {
      setStatus(error.message || 'Could not reset these colors.', true);
    }
  });

  element('export-themes').addEventListener('click', () => {
    try {
      const payload = api.exportPresets(settings);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'proxy-switcher-themes.json';
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Theme presets exported. Proxy profiles and credentials are not included.');
    } catch (error) {
      setStatus(error.message || 'Could not export themes.', true);
    }
  });

  const importInput = element('import-themes-file');
  element('import-themes').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Import file exceeds the 1 MB limit.');
      const latest = await api.getSettings();
      const previousIds = new Set(latest.presets.map(preset => preset.id));
      const next = api.importPresets(latest, await file.text());
      const added = next.presets.filter(preset => !previousIds.has(preset.id));
      if (added.length) {
        selectedPresetId = added[0].id;
        activeVariant = added[0].type === 'single' ? added[0].base : 'light';
        await save(next, `${added.length} theme preset${added.length === 1 ? '' : 's'} imported.`);
      } else {
        settings = next;
        render();
        setStatus('No presets imported. All five slots may already be in use.');
      }
    } catch (error) {
      setStatus(error.message || 'Could not import themes.', true);
    } finally {
      importInput.value = '';
    }
  });

  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener(async (changes, area) => {
      if (area !== 'local' || !changes[api.storageKey]) return;
      const latest = await api.getSettings();
      const previousSelectedId = selectedPresetId;
      settings = latest;
      if (!settings.presets.some(preset => preset.id === previousSelectedId)) {
        selectedPresetId = settings.presets[0] ? settings.presets[0].id : null;
      }
      render();
    });
  }

  render();
  setStatus(settings.presets.length ? 'Select a preset to edit, or create another one.' : 'Create your first custom preset.');
});
