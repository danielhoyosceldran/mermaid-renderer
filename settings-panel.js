// Settings dialog: editor preferences + rebindable keymap.

import {
  DEFAULT_SETTINGS,
  COMMAND_LABELS,
  eventToCombo,
  formatCombo,
  saveSettings,
} from './editor.js';

export function createSettingsPanel(settings, onApply) {
  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.innerHTML = `
    <div id="settings-dialog" role="dialog" aria-label="Editor settings">
      <div class="settings-header">
        <h2>Editor settings</h2>
        <button class="settings-close" title="Close">&times;</button>
      </div>
      <div class="settings-body">
        <section class="settings-group">
          <label class="settings-row">
            <span>Tab size</span>
            <input type="number" min="1" max="8" data-field="tabSize" />
          </label>
          <label class="settings-row">
            <span>Insert spaces instead of tabs</span>
            <input type="checkbox" data-field="insertSpaces" />
          </label>
          <label class="settings-row">
            <span>Keep indentation on Enter</span>
            <input type="checkbox" data-field="autoIndent" />
          </label>
          <label class="settings-row">
            <span>Comment token</span>
            <input type="text" size="4" data-field="commentToken" />
          </label>
          <label class="settings-row">
            <span>Zoom speed</span>
            <input type="number" min="0" max="0.6" step="0.01" data-field="zoomSpeed" />
          </label>
        </section>
        <section class="settings-group">
          <h3>Shortcuts <small>click a binding, then press keys</small></h3>
          <div id="keymap-list"></div>
        </section>
      </div>
      <div class="settings-footer">
        <button class="settings-reset">Reset defaults</button>
        <button class="settings-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('#settings-dialog');
  const keymapList = overlay.querySelector('#keymap-list');
  let capturing = null;

  function persist() {
    saveSettings(settings);
    onApply(settings);
  }

  function renderFields() {
    overlay.querySelectorAll('[data-field]').forEach((input) => {
      const key = input.dataset.field;
      if (input.type === 'checkbox') input.checked = settings[key];
      else input.value = settings[key];
    });
  }

  function renderKeymap() {
    keymapList.innerHTML = '';
    for (const name of Object.keys(DEFAULT_SETTINGS.keymap)) {
      const row = document.createElement('div');
      row.className = 'settings-row';
      const label = document.createElement('span');
      label.textContent = COMMAND_LABELS[name] || name;
      const btn = document.createElement('button');
      btn.className = 'keybind';
      btn.dataset.command = name;
      btn.textContent = settings.keymap[name]
        ? formatCombo(settings.keymap[name])
        : 'unbound';
      row.append(label, btn);
      keymapList.appendChild(row);
    }
  }

  function stopCapture() {
    if (!capturing) return;
    capturing.btn.classList.remove('capturing');
    capturing = null;
    renderKeymap();
  }

  keymapList.addEventListener('click', (e) => {
    const btn = e.target.closest('.keybind');
    if (!btn) return;
    stopCapture();
    capturing = { name: btn.dataset.command, btn };
    btn.classList.add('capturing');
    btn.textContent = 'press keys…';
  });

  overlay.addEventListener('keydown', (e) => {
    if (!capturing) {
      if (e.key === 'Escape') close();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      stopCapture();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      settings.keymap[capturing.name] = '';
      persist();
      stopCapture();
      return;
    }
    const combo = eventToCombo(e);
    if (!combo) return;
    // Clear any other command holding the same combo.
    for (const [name, binding] of Object.entries(settings.keymap)) {
      if (binding === combo && name !== capturing.name) settings.keymap[name] = '';
    }
    settings.keymap[capturing.name] = combo;
    persist();
    stopCapture();
  });

  overlay.addEventListener('input', (e) => {
    const input = e.target.closest('[data-field]');
    if (!input) return;
    const key = input.dataset.field;
    if (input.type === 'checkbox') settings[key] = input.checked;
    else if (input.type === 'number') {
      const n = parseFloat(input.value);
      if (!Number.isNaN(n)) {
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        settings[key] = Math.min(max, Math.max(min, n));
      }
    } else settings[key] = input.value;
    persist();
  });

  overlay.querySelector('.settings-reset').addEventListener('click', () => {
    Object.assign(settings, structuredClone(DEFAULT_SETTINGS));
    persist();
    renderFields();
    renderKeymap();
  });

  overlay.querySelector('.settings-close').addEventListener('click', () => close());
  overlay.querySelector('.settings-done').addEventListener('click', () => close());
  overlay.addEventListener('mousedown', (e) => {
    if (!dialog.contains(e.target)) close();
  });

  function open() {
    renderFields();
    renderKeymap();
    overlay.classList.add('visible');
    dialog.focus();
  }

  function close() {
    stopCapture();
    overlay.classList.remove('visible');
  }

  dialog.tabIndex = -1;

  return { open, close };
}
