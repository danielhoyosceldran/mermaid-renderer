import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';
import { loadSettings, saveSettings } from './editor.js';
import { createSettingsPanel } from './settings-panel.js';
import { createEditor } from './cm-editor.js';

// securityLevel is pinned rather than left to mermaid's default, because the
// rendered SVG is injected with innerHTML below.
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const editorHost = document.getElementById('editor-host');
const btnSettings = document.getElementById('btn-settings');
const btnWrap = document.getElementById('btn-wrap');
const btnBrWrap = document.getElementById('btn-br-wrap');
const btnSuggestions = document.getElementById('btn-suggestions');
const output = document.getElementById('output');
const splitter = document.getElementById('splitter');
const btnOpen = document.getElementById('btn-open');
const fileInput = document.getElementById('file-input');
const leftPanel = document.getElementById('left-panel');
const main = document.getElementById('main');
const toolbarLeft = document.getElementById('toolbar-left');
const viewport = document.getElementById('viewport');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const zoomSpeedSlider = document.getElementById('zoom-speed');
const zoomSpeedValue = document.getElementById('zoom-speed-value');
const btnZoomSpeedDown = document.getElementById('btn-zoom-speed-down');
const btnZoomSpeedUp = document.getElementById('btn-zoom-speed-up');
const btnPopout = document.getElementById('btn-popout');

const STORAGE_KEY = 'mermaid-renderer:diagram';
const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

const settings = loadSettings();

// --- editor ------------------------------------------------------------------

const saved = localStorage.getItem(STORAGE_KEY);

const editor = createEditor({
  parent: editorHost,
  doc: saved !== null ? saved : DEFAULT_DIAGRAM,
  getSettings: () => settings,
  onChange: onEditorChange,
  placeholder: 'Enter Mermaid diagram code...',
});

function onEditorChange() {
  scheduleRender();
  scheduleAutosave();
}

// --- render ------------------------------------------------------------------

// Unique ID required by mermaid.render; reuse causes conflicts
let renderId = 0;

const liveChannel = new BroadcastChannel('mermaid-live');
liveChannel.onmessage = (e) => {
  if (e.data && e.data.type === 'request-sync') {
    liveChannel.postMessage({ code: editor.getValue() });
  }
};

async function renderDiagram() {
  clearTimeout(debounceTimer);
  const source = editor.getValue();
  const code = source.trim();
  liveChannel.postMessage({ code: source });
  if (!code) {
    output.innerHTML = '';
    return;
  }
  // Renders can resolve out of order, so only the newest one may paint.
  const myId = ++renderId;
  const id = 'mermaid-render-' + myId;
  try {
    const { svg } = await mermaid.render(id, code);
    if (myId !== renderId) return;
    output.innerHTML = svg;
    fitToWidth();
  } catch (err) {
    // Remove orphaned element mermaid may have injected
    const orphan = document.getElementById(id);
    if (orphan) orphan.remove();
    if (myId !== renderId) return;
    output.textContent = err && err.message ? err.message : String(err);
  }
}

// Hot reload with 400 ms debounce
let debounceTimer;
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDiagram, 400);
}

btnPopout.addEventListener('click', () => {
  window.open('preview.html', 'mermaid-preview', 'width=800,height=600');
});

// --- persistence -------------------------------------------------------------

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => writeToLocalStorage(false), 800);
}

function writeToLocalStorage(explicit) {
  clearTimeout(autosaveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
    if (explicit) showToast('Saved');
  } catch {
    showToast('Could not save: browser storage is full or blocked');
  }
}

window.addEventListener('beforeunload', () => writeToLocalStorage(false));

// Save editor content as .mmd
function saveMermaid() {
  const blob = new Blob([editor.getValue()], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagram.mmd';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick can abort the download the click just started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

// Open .mmd / .txt file
btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    editor.setValue(await file.text());
  } catch (err) {
    showToast('Could not read file: ' + (err && err.message ? err.message : err));
    return;
  }
  renderDiagram();
});

// --- settings ----------------------------------------------------------------

// Single entry point, so toggles, the settings dialog and "Reset defaults" can
// never leave the UI and the editor disagreeing about the settings object.
function applyAllSettings() {
  editor.applySettings();
  btnWrap.classList.toggle('active', settings.wordWrap);
  btnBrWrap.classList.toggle('active', settings.brWrap);
  btnSuggestions.classList.toggle('active', settings.suggestions);
  syncZoomSpeedUI();
}

function toggleSetting(name) {
  settings[name] = !settings[name];
  saveSettings(settings);
  applyAllSettings();
}

btnWrap.addEventListener('click', () => toggleSetting('wordWrap'));
btnBrWrap.addEventListener('click', () => toggleSetting('brWrap'));
btnSuggestions.addEventListener('click', () => toggleSetting('suggestions'));

document.addEventListener('keydown', (e) => {
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    toggleSetting('wordWrap');
  }
});

function syncZoomSpeedUI() {
  zoomSpeedSlider.value = String(settings.zoomSpeed);
  zoomSpeedValue.textContent = settings.zoomSpeed.toFixed(2);
}

zoomSpeedSlider.addEventListener('input', () => {
  settings.zoomSpeed = parseFloat(zoomSpeedSlider.value);
  zoomSpeedValue.textContent = settings.zoomSpeed.toFixed(2);
  saveSettings(settings);
});

function stepZoomSpeed(delta) {
  const min = parseFloat(zoomSpeedSlider.min);
  const max = parseFloat(zoomSpeedSlider.max);
  settings.zoomSpeed = Math.min(max, Math.max(min, settings.zoomSpeed + delta));
  syncZoomSpeedUI();
  saveSettings(settings);
}

btnZoomSpeedDown.addEventListener('click', () => stepZoomSpeed(-0.01));
btnZoomSpeedUp.addEventListener('click', () => stepZoomSpeed(0.01));

const settingsPanel = createSettingsPanel(settings, applyAllSettings);
btnSettings.addEventListener('click', () => settingsPanel.open());

// --- global shortcuts --------------------------------------------------------

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
    writeToLocalStorage(true);
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    renderDiagram();
  }
});

// --- pan/zoom on right panel -------------------------------------------------
// zoom = 1 means the diagram's natural width fills the viewport width
// (baseScale handles that conversion); zoom itself is the user-facing multiplier.
let zoom = 1;
let panX = 0;
let panY = 0;
let baseScale = 1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;

function applyTransform() {
  const scale = baseScale * zoom;
  output.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  btnZoomReset.textContent = Math.round(zoom * 100) + '%';
}

// Recompute baseScale so the diagram's natural width fills the viewport width.
function fitToWidth() {
  const svg = output.querySelector('svg');
  const naturalWidth = svg ? svg.getBoundingClientRect().width / (baseScale * zoom) : 0;
  const viewportWidth = viewport.clientWidth;
  baseScale = naturalWidth > 0 ? viewportWidth / naturalWidth : 1;
  applyTransform();
}

function resetView() {
  zoom = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function zoomAt(factor, clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
  const ratio = newZoom / zoom;
  panX = x - ratio * (x - panX);
  panY = y - ratio * (y - panY);
  zoom = newZoom;
  applyTransform();
}

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    const speed = settings.zoomSpeed;
    const factor = e.deltaY < 0 ? 1 + speed : 1 / (1 + speed);
    zoomAt(factor, e.clientX, e.clientY);
    return;
  }
  panX -= e.deltaX;
  panY -= e.deltaY;
  applyTransform();
}, { passive: false });

btnZoomIn.addEventListener('click', () => {
  const rect = viewport.getBoundingClientRect();
  const factor = 1 + settings.zoomSpeed * 3;
  zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
});
btnZoomOut.addEventListener('click', () => {
  const rect = viewport.getBoundingClientRect();
  const factor = 1 / (1 + settings.zoomSpeed * 3);
  zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
});
btnZoomReset.addEventListener('click', resetView);

let panning = false;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;

viewport.addEventListener('mousedown', (e) => {
  panning = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  panOriginX = panX;
  panOriginY = panY;
  viewport.classList.add('panning');
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!panning) return;
  panX = panOriginX + (e.clientX - panStartX);
  panY = panOriginY + (e.clientY - panStartY);
  applyTransform();
});

document.addEventListener('mouseup', () => {
  panning = false;
  viewport.classList.remove('panning');
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
  fitToWidth();
});

document.addEventListener('mouseup', () => {
  dragging = false;
});

window.addEventListener('resize', fitToWidth);

// --- boot --------------------------------------------------------------------

applyAllSettings();
applyTransform();
renderDiagram();
