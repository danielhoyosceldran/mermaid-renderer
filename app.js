import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';
import { attachEditor, loadSettings } from './editor.js';
import { createSettingsPanel } from './settings-panel.js';
import { attachAutocomplete } from './autocomplete.js';

mermaid.initialize({ startOnLoad: false });

const editor = document.getElementById('editor');
const btnSettings = document.getElementById('btn-settings');
const output = document.getElementById('output');
const splitter = document.getElementById('splitter');
const btnOpen = document.getElementById('btn-open');
const fileInput = document.getElementById('file-input');
const leftPanel = document.getElementById('left-panel');
const main = document.getElementById('main');
const toolbarLeft = document.getElementById('toolbar-left');

// Unique ID required by mermaid.render; reuse causes conflicts
let renderId = 0;

async function renderDiagram() {
  const code = editor.value.trim();
  if (!code) {
    output.innerHTML = '';
    return;
  }
  const id = 'mermaid-render-' + (++renderId);
  try {
    const { svg } = await mermaid.render(id, code);
    output.innerHTML = svg;
  } catch (err) {
    // Remove orphaned element mermaid may have injected
    const orphan = document.getElementById(id);
    if (orphan) orphan.remove();
    output.textContent = err && err.message ? err.message : String(err);
  }
}

// Hot reload with 400 ms debounce
let debounceTimer;
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDiagram, 400);
}
editor.addEventListener('input', scheduleRender);

// Autocomplete is attached first so that, while its popup is open, it can claim
// Tab/Enter/arrows before the editor keymap sees them.
attachAutocomplete(editor, scheduleRender);

// Code-editor behaviours (indentation, line ops, comments)
const settings = loadSettings();
attachEditor(editor, () => settings, scheduleRender);
applyEditorSettings();

function applyEditorSettings() {
  editor.style.tabSize = String(settings.tabSize);
}

const settingsPanel = createSettingsPanel(settings, () => {
  applyEditorSettings();
});
btnSettings.addEventListener('click', () => settingsPanel.open());

// Open .mmd / .txt file
btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editor.value = await file.text();
  renderDiagram();
  fileInput.value = '';
});

// Save editor content as .mmd
function saveMermaid() {
  const blob = new Blob([editor.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagram.mmd';
  a.click();
  URL.revokeObjectURL(url);
}

// Autosave to localStorage
const STORAGE_KEY = 'mermaid-renderer:diagram';

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, editor.value);
  showToast('Saved');
}

let toastTimer;
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  // Check Shift+S before plain S
  if (e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveMermaid();
    return;
  }

  if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveToLocalStorage();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    renderDiagram();
  }
});

// Splitter drag logic
let dragging = false;
let dragStartX = 0;
let dragStartWidth = 0;

splitter.addEventListener('mousedown', (e) => {
  dragging = true;
  dragStartX = e.clientX;
  dragStartWidth = leftPanel.offsetWidth;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const mainWidth = main.offsetWidth;
  const delta = e.clientX - dragStartX;
  const newWidth = Math.min(
    mainWidth - 150 - splitter.offsetWidth,
    Math.max(150, dragStartWidth + delta)
  );
  leftPanel.style.width = newWidth + 'px';
  toolbarLeft.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  dragging = false;
});

// Load saved diagram, else default
const saved = localStorage.getItem(STORAGE_KEY);
editor.value = saved !== null ? saved : `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

renderDiagram();
