/* Color-only theme management shared by the popup, options page, and theme editor. */
(() => {
  const STORAGE_KEY = 'uiThemeSettings';
  const SETTINGS_VERSION = 2;
  const EXPORT_FORMAT = 'proxy-switcher-themes';
  const EXPORT_VERSION = 1;
  const MAX_PRESETS = 5;
  const MAX_PRESET_NAME_LENGTH = 48;
  const MAX_IMPORT_BYTES = 1024 * 1024;

  const themes = {
    warm: {
      'color-bg': '#F6F0E8', 'color-surface': '#FFFBF5', 'color-surface-raised': '#FFFFFF',
      'color-text': '#433A35', 'color-text-muted': '#796E65', 'color-border': '#E4D9CB',
      'color-primary': '#456B9B', 'color-primary-hover': '#36577F', 'color-primary-text': '#FFFFFF',
      'color-secondary': '#EEE6DC', 'color-secondary-hover': '#E2D7CA', 'color-secondary-text': '#51463D',
      'color-success': '#356B4D', 'color-success-bg': '#DCEBDD', 'color-success-text': '#244B35',
      'color-danger': '#A43F3F', 'color-danger-bg': '#F7E2DE', 'color-danger-text': '#762C2C',
      'color-info': '#3F6F91', 'color-info-bg': '#E0EDF5', 'color-info-text': '#254B66',
      'color-input-bg': '#FFFFFF', 'color-focus': '#456B9B', 'color-tag-bg': '#E8DDD0',
      'color-overlay': 'rgba(35, 29, 25, 0.52)'
    },
    harbor: {
      'color-bg': '#292B2F', 'color-surface': '#32353A', 'color-surface-raised': '#3A3D43',
      'color-text': '#E6E4E1', 'color-text-muted': '#B6B3AE', 'color-border': '#4B4E54',
      'color-primary': '#A6C4E8', 'color-primary-hover': '#BDD5F1', 'color-primary-text': '#24282E',
      'color-secondary': '#45484E', 'color-secondary-hover': '#53565D', 'color-secondary-text': '#F0EEEA',
      'color-success': '#75B895', 'color-success-bg': '#304B3C', 'color-success-text': '#BFE6CC',
      'color-danger': '#E58B83', 'color-danger-bg': '#512F31', 'color-danger-text': '#FFD8D3',
      'color-info': '#91B8D9', 'color-info-bg': '#2D414F', 'color-info-text': '#D6EAF8',
      'color-input-bg': '#26282C', 'color-focus': '#A6C4E8', 'color-tag-bg': '#45484E',
      'color-overlay': 'rgba(0, 0, 0, 0.66)'
    }
  };

  const tokenLabels = {
    'color-bg': 'Page background',
    'color-surface': 'Section surface',
    'color-surface-raised': 'Cards and raised panels',
    'color-text': 'Primary text',
    'color-text-muted': 'Secondary text',
    'color-border': 'Borders and separators',
    'color-primary': 'Primary action and accent',
    'color-primary-hover': 'Primary action hover',
    'color-primary-text': 'Primary action text',
    'color-secondary': 'Secondary action background',
    'color-secondary-hover': 'Secondary action hover',
    'color-secondary-text': 'Secondary action text',
    'color-success': 'Success status',
    'color-success-bg': 'Success message background',
    'color-success-text': 'Success message text',
    'color-danger': 'Danger action and error status',
    'color-danger-bg': 'Error message background',
    'color-danger-text': 'Error message text',
    'color-info': 'Information accent',
    'color-info-bg': 'Information message background',
    'color-info-text': 'Information message text',
    'color-input-bg': 'Input background',
    'color-focus': 'Keyboard focus outline',
    'color-tag-bg': 'Tag background',
    'color-overlay': 'Modal backdrop'
  };
  const tokenKeys = new Set(Object.keys(tokenLabels));
  const defaults = { version: SETTINGS_VERSION, mode: 'system', presets: [] };

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  }

  function normalizeOverrides(source) {
    const result = {};
    if (!isRecord(source)) return result;
    for (const [key, value] of Object.entries(source)) {
      if (tokenKeys.has(key) && isHexColor(value)) result[key] = value.toUpperCase();
    }
    return result;
  }

  function createId(existingIds = new Set()) {
    let id = '';
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      }
    } catch (_) {
      id = '';
    }
    if (!id) id = `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    while (existingIds.has(id)) id = `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return id;
  }

  function normalizePreset(source, index, usedIds = new Set()) {
    if (!isRecord(source)) return null;
    const type = source.type === 'pair' ? 'pair' : source.type === 'single' ? 'single' : null;
    if (!type) return null;
    const requestedId = typeof source.id === 'string' ? source.id.trim() : '';
    let id = /^[a-zA-Z0-9_-]{1,80}$/.test(requestedId) ? requestedId : '';
    if (!id || usedIds.has(id)) id = createId(usedIds);
    usedIds.add(id);
    const rawName = typeof source.name === 'string' ? source.name.trim() : '';
    const name = (rawName || `Preset ${index + 1}`).slice(0, MAX_PRESET_NAME_LENGTH);
    if (type === 'single') {
      return {
        id,
        name,
        type,
        base: source.base === 'dark' || source.base === 'harbor' ? 'dark' : 'light',
        overrides: normalizeOverrides(source.overrides)
      };
    }
    return {
      id,
      name,
      type,
      lightOverrides: normalizeOverrides(source.lightOverrides),
      darkOverrides: normalizeOverrides(source.darkOverrides)
    };
  }

  function mapLegacyMode(mode) {
    if (mode === 'warm') return 'light';
    if (mode === 'harbor') return 'dark';
    if (mode === 'firefox') return 'system';
    return mode;
  }

  function normalizeSettings(source) {
    if (!isRecord(source)) return { ...defaults, presets: [] };

    const usedIds = new Set();
    const incomingPresets = Array.isArray(source.presets) ? source.presets : [];
    const presets = [];
    for (let index = 0; index < incomingPresets.length && presets.length < MAX_PRESETS; index += 1) {
      const preset = normalizePreset(incomingPresets[index], index, usedIds);
      if (preset) presets.push(preset);
    }

    const isCurrentVersion = source.version === SETTINGS_VERSION;
    const legacyOverrides = isCurrentVersion ? {} : normalizeOverrides(source.overrides);
    const rawMode = typeof source.mode === 'string' ? source.mode : 'system';
    let mode = mapLegacyMode(rawMode);

    if (!isCurrentVersion && (rawMode === 'custom' || Object.keys(legacyOverrides).length > 0)) {
      let legacyPreset = presets.find(preset => preset.id === 'legacy-custom');
      if (!legacyPreset && presets.length < MAX_PRESETS) {
        const base = source.base === 'harbor' || source.base === 'dark' ? 'dark' : 'light';
        const id = usedIds.has('legacy-custom') ? createId(usedIds) : 'legacy-custom';
        usedIds.add(id);
        legacyPreset = {
          id,
          name: 'Imported custom theme',
          type: 'single',
          base,
          overrides: legacyOverrides
        };
        presets.push(legacyPreset);
      }
      if (rawMode === 'custom' && legacyPreset) mode = `preset:${legacyPreset.id}`;
    }

    if (mode !== 'system' && mode !== 'light' && mode !== 'dark' && !mode.startsWith('preset:')) mode = 'system';
    if (mode.startsWith('preset:') && !presets.some(preset => preset.id === mode.slice(7))) mode = 'system';

    return { version: SETTINGS_VERSION, mode, presets };
  }

  function normalizedCurrentSettings(settings) {
    return normalizeSettings(settings);
  }

  function createPreset(settings, input) {
    const normalized = normalizedCurrentSettings(settings);
    const options = isRecord(input) ? input : {};
    const name = typeof options.name === 'string' ? options.name.trim().slice(0, MAX_PRESET_NAME_LENGTH) : '';
    if (!name) throw new Error('A preset name is required.');
    if (options.type !== 'single' && options.type !== 'pair') throw new Error('Preset type must be single or pair.');
    if (normalized.presets.length >= MAX_PRESETS) throw new Error('The maximum of five presets has been reached.');
    const id = createId(new Set(normalized.presets.map(preset => preset.id)));
    const preset = options.type === 'pair'
      ? { id, name, type: 'pair', lightOverrides: {}, darkOverrides: {} }
      : { id, name, type: 'single', base: options.base === 'dark' ? 'dark' : 'light', overrides: {} };
    return { ...normalized, presets: [...normalized.presets, preset] };
  }

  function renamePreset(settings, id, requestedName) {
    const normalized = normalizedCurrentSettings(settings);
    const name = typeof requestedName === 'string' ? requestedName.trim().slice(0, MAX_PRESET_NAME_LENGTH) : '';
    if (!name) throw new Error('A preset name is required.');
    let found = false;
    const presets = normalized.presets.map(preset => {
      if (preset.id !== id) return preset;
      found = true;
      return { ...preset, name };
    });
    if (!found) throw new Error('Preset not found.');
    return { ...normalized, presets };
  }

  function deletePreset(settings, id) {
    const normalized = normalizedCurrentSettings(settings);
    const presets = normalized.presets.filter(preset => preset.id !== id);
    if (presets.length === normalized.presets.length) throw new Error('Preset not found.');
    const mode = normalized.mode === `preset:${id}` ? 'system' : normalized.mode;
    return { ...normalized, mode, presets };
  }

  function exportPresets(settings) {
    const normalized = normalizedCurrentSettings(settings);
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      presets: normalized.presets.map(preset => JSON.parse(JSON.stringify(preset)))
    };
  }

  function importPresets(settings, payload) {
    let data = payload;
    if (typeof payload === 'string') {
      if (payload.length > MAX_IMPORT_BYTES) throw new Error('Import file exceeds the 1 MB limit.');
      try {
        data = JSON.parse(payload);
      } catch (_) {
        throw new Error('The import file is not valid JSON.');
      }
    }
    if (!isRecord(data) || data.format !== EXPORT_FORMAT || data.version !== EXPORT_VERSION || !Array.isArray(data.presets)) {
      throw new Error('Invalid theme export format.');
    }
    if (data.presets.length > MAX_PRESETS) throw new Error('An import file cannot contain more than five presets.');

    const normalized = normalizedCurrentSettings(settings);
    const presets = [...normalized.presets];
    const usedIds = new Set(presets.map(preset => preset.id));
    let importedCount = 0;
    for (const candidate of data.presets) {
      if (presets.length >= MAX_PRESETS) break;
      if (!isRecord(candidate) || !['single', 'pair'].includes(candidate.type)) continue;
      if (typeof candidate.name !== 'string' || !candidate.name.trim()) continue;
      const imported = normalizePreset(candidate, presets.length, usedIds);
      if (!imported) continue;
      if (presets.some(existing => existing.id === imported.id)) imported.id = createId(usedIds);
      usedIds.add(imported.id);
      presets.push(imported);
      importedCount += 1;
    }
    if (data.presets.length > 0 && importedCount === 0 && normalized.presets.length < MAX_PRESETS) {
      throw new Error('No valid themes were found in the import file.');
    }
    return { ...normalized, presets };
  }

  function colorToCss(key, value) {
    if (!isHexColor(value)) return null;
    if (key !== 'color-overlay') return value.toUpperCase();
    const red = parseInt(value.slice(1, 3), 16);
    const green = parseInt(value.slice(3, 5), 16);
    const blue = parseInt(value.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, 0.55)`;
  }

  function applyOverrides(palette, overrides) {
    for (const [key, value] of Object.entries(normalizeOverrides(overrides))) {
      const cssValue = colorToCss(key, value);
      if (cssValue) palette[key] = cssValue;
    }
    return palette;
  }

  function resolvePalette(settings, isDark) {
    const normalized = normalizedCurrentSettings(settings);
    const dark = Boolean(isDark);
    let themeName = dark ? 'harbor' : 'warm';
    let selectedPreset = null;
    let overrides = {};

    if (normalized.mode === 'light') {
      themeName = 'warm';
    } else if (normalized.mode === 'dark') {
      themeName = 'harbor';
    } else if (normalized.mode.startsWith('preset:')) {
      selectedPreset = normalized.presets.find(preset => preset.id === normalized.mode.slice(7)) || null;
      if (!selectedPreset) {
        themeName = dark ? 'harbor' : 'warm';
      } else if (selectedPreset.type === 'single') {
        themeName = selectedPreset.base === 'dark' ? 'harbor' : 'warm';
        overrides = selectedPreset.overrides;
      } else {
        themeName = dark ? 'harbor' : 'warm';
        overrides = dark ? selectedPreset.darkOverrides : selectedPreset.lightOverrides;
      }
    }

    const palette = { ...themes[themeName] };
    applyOverrides(palette, overrides);
    return { mode: normalized.mode, themeName, palette, preset: selectedPreset };
  }

  function apply(settings) {
    const dark = Boolean(mediaQuery && mediaQuery.matches);
    const resolved = resolvePalette(settings, dark);
    const root = document.documentElement;
    root.dataset.theme = resolved.themeName;
    root.style.colorScheme = resolved.themeName === 'harbor' ? 'dark' : 'light';
    for (const [key, value] of Object.entries(resolved.palette)) root.style.setProperty(`--${key}`, value);
    document.dispatchEvent(new CustomEvent('proxy-switcher-theme-changed', {
      detail: { mode: resolved.mode, themeName: resolved.themeName, presetId: resolved.preset ? resolved.preset.id : null }
    }));
    return resolved;
  }

  let mediaQuery = null;
  try {
    if (typeof window !== 'undefined' && window.matchMedia) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  } catch (_) {
    mediaQuery = null;
  }

  async function getSettings() {
    let raw;
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      raw = data[STORAGE_KEY];
    } catch (_) {
      return normalizeSettings(null);
    }

    const settings = normalizeSettings(raw);
    if (raw && raw.version !== SETTINGS_VERSION) {
      try {
        await browser.storage.local.set({ [STORAGE_KEY]: settings });
      } catch (_) {
        // Keep the migrated values in memory for this session if persistence fails.
      }
    }
    return settings;
  }

  async function refresh() {
    const settings = await getSettings();
    const resolved = apply(settings);
    return { ...settings, resolvedTheme: resolved.themeName };
  }

  if (mediaQuery) {
    const onSchemeChange = () => refresh();
    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', onSchemeChange);
    else if (typeof mediaQuery.addListener === 'function') mediaQuery.addListener(onSchemeChange);
  }

  window.ProxySwitcherTheme = {
    getSettings,
    refresh,
    apply,
    resolvePalette,
    normalizeSettings,
    createPreset,
    renamePreset,
    deletePreset,
    exportPresets,
    importPresets,
    themes,
    tokenLabels,
    storageKey: STORAGE_KEY,
    settingsVersion: SETTINGS_VERSION,
    maxPresets: MAX_PRESETS,
    exportFormat: EXPORT_FORMAT,
    exportVersion: EXPORT_VERSION
  };

  document.addEventListener('DOMContentLoaded', refresh);
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) refresh();
    });
  }
})();
