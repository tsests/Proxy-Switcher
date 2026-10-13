document.addEventListener('DOMContentLoaded', async () => {
  const api = window.ProxySwitcherTheme;
  const select = document.getElementById('theme-mode');
  if (!api || !select) return;

  const staticValues = new Set(['system', 'light', 'dark']);

  function renderOptions(settings) {
    const selected = settings.mode;
    for (const option of Array.from(select.options)) {
      if (option.dataset.customPreset === 'true') option.remove();
    }
    let group = select.querySelector('optgroup[data-custom-presets="true"]');
    if (group) group.remove();
    if (settings.presets.length) {
      group = document.createElement('optgroup');
      group.label = 'Custom presets';
      group.dataset.customPresets = 'true';
      for (const preset of settings.presets) {
        const option = document.createElement('option');
        option.value = `preset:${preset.id}`;
        option.textContent = preset.name;
        option.dataset.customPreset = 'true';
        group.appendChild(option);
      }
      select.appendChild(group);
    }
    select.value = staticValues.has(selected) || selected.startsWith('preset:') ? selected : 'system';
    if (select.value !== selected) select.value = 'system';
  }

  async function syncFromStorage() {
    const settings = await api.getSettings();
    renderOptions(settings);
  }

  select.addEventListener('change', async () => {
    const current = await api.getSettings();
    const requestedMode = select.value;
    const validPreset = requestedMode.startsWith('preset:')
      && current.presets.some(preset => `preset:${preset.id}` === requestedMode);
    const mode = staticValues.has(requestedMode) || validPreset ? requestedMode : 'system';
    await browser.storage.local.set({ [api.storageKey]: { ...current, mode } });
  });

  await syncFromStorage();
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[api.storageKey]) syncFromStorage();
    });
  }
});
