import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';
import { attachEditor, loadSettings, saveSettings } from './editor.js';
import { createSettingsPanel } from './settings-panel.js';
import { attachAutocomplete } from './autocomplete.js';
import { highlightToHtml } from './highlight.js';

mermaid.initialize({ startOnLoad: false });

const editor = document.getElementById('editor');
const editorHighlight = document.getElementById('editor-highlight');
const editorGutter = document.getElementById('editor-gutter');
const editorWrapEl = document.getElementById('editor-wrap');
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

// Unique ID required by mermaid.render; reuse causes conflicts
let renderId = 0;

const liveChannel = new BroadcastChannel('mermaid-live');
liveChannel.onmessage = (e) => {
  if (e.data && e.data.type === 'request-sync') {
    liveChannel.postMessage({ code: editor.value });
  }
};

async function renderDiagram() {
  const code = editor.value.trim();
  liveChannel.postMessage({ code: editor.value });
  if (!code) {
    output.innerHTML = '';
    return;
  }
  const id = 'mermaid-render-' + (++renderId);
  try {
    const { svg } = await mermaid.render(id, code);
    output.innerHTML = svg;
    fitToWidth();
  } catch (err) {
    // Remove orphaned element mermaid may have injected
    const orphan = document.getElementById(id);
    if (orphan) orphan.remove();
    output.textContent = err && err.message ? err.message : String(err);
  }
}

btnPopout.addEventListener('click', () => {
  window.open('preview.html', 'mermaid-preview', 'width=800,height=600');
});

function updateHighlight() {
  // Trailing newline needs a trailing blank line to keep heights in sync.
  editorHighlight.innerHTML = highlightToHtml(editor.value, settings.brWrap) + '\n';
}

let measureEl;
function ensureMeasureEl() {
  if (measureEl) return measureEl;
  measureEl = document.createElement('div');
  const s = measureEl.style;
  s.position = 'absolute';
  s.visibility = 'hidden';
  s.top = '0';
  s.left = '-99999px';
  s.margin = '0';
  s.padding = '0';
  s.whiteSpace = 'pre-wrap';
  s.wordWrap = 'break-word';
  s.overflowWrap = 'break-word';
  s.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
  s.fontSize = '13px';
  s.lineHeight = '1.5';
  document.body.appendChild(measureEl);
  return measureEl;
}

// Number of visual (wrapped) rows each logical line occupies, so the gutter
// can put a blank line under a number for each wrap instead of counting it
// as a new line.
function measureWrappedRowCounts(lines) {
  const el = ensureMeasureEl();
  const contentWidth = editor.clientWidth - 24; // 12px padding each side
  el.style.width = Math.max(0, contentWidth) + 'px';
  el.innerHTML = '';
  const divs = lines.map((line) => {
    const d = document.createElement('div');
    d.textContent = line.length ? line : '​';
    el.appendChild(d);
    return d;
  });
  const lineHeightPx = 13 * 1.5;
  return divs.map((d) => Math.max(1, Math.round(d.offsetHeight / lineHeightPx)));
}

function updateGutter() {
  const lines = editor.value.split('\n');
  const lineCount = lines.length;
  const digits = String(lineCount).length;
  editorWrapEl.style.setProperty('--gutter-width', Math.max(2, digits + 1.5) + 'ch');

  let html = '';
  if (settings.wordWrap) {
    const rowCounts = measureWrappedRowCounts(lines);
    for (let i = 0; i < lineCount; i++) {
      html += (i + 1) + '\n'.repeat(rowCounts[i]);
    }
  } else {
    for (let i = 1; i <= lineCount; i++) html += i + '\n';
  }
  editorGutter.textContent = html;
}

editor.addEventListener('input', updateHighlight);
editor.addEventListener('input', updateGutter);
editor.addEventListener('scroll', () => {
  editorHighlight.scrollTop = editor.scrollTop;
  editorHighlight.scrollLeft = editor.scrollLeft;
  editorGutter.scrollTop = editor.scrollTop;
});

function applyWordWrap() {
  editorWrapEl.classList.toggle('no-wrap', !settings.wordWrap);
  btnWrap.classList.toggle('active', settings.wordWrap);
}

function toggleWordWrap() {
  settings.wordWrap = !settings.wordWrap;
  saveSettings(settings);
  applyWordWrap();
  updateGutter();
}

new ResizeObserver(() => {
  if (settings.wordWrap) updateGutter();
}).observe(editor);

btnWrap.addEventListener('click', toggleWordWrap);

function applyBrWrap() {
  btnBrWrap.classList.toggle('active', settings.brWrap);
}

function toggleBrWrap() {
  settings.brWrap = !settings.brWrap;
  saveSettings(settings);
  applyBrWrap();
  updateHighlight();
}

btnBrWrap.addEventListener('click', toggleBrWrap);

// Hot reload with 400 ms debounce
let debounceTimer;
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDiagram, 400);
}
editor.addEventListener('input', scheduleRender);

// Code-editor behaviours (indentation, line ops, comments)
const settings = loadSettings();

// Autocomplete is attached first so that, while its popup is open, it can claim
// Tab/Enter/arrows before the editor keymap sees them.
attachAutocomplete(editor, scheduleRender, () => settings);

attachEditor(editor, () => settings, scheduleRender);
applyEditorSettings();

function applySuggestions() {
  btnSuggestions.classList.toggle('active', settings.suggestions);
}

function toggleSuggestions() {
  settings.suggestions = !settings.suggestions;
  saveSettings(settings);
  applySuggestions();
}

btnSuggestions.addEventListener('click', toggleSuggestions);
applySuggestions();

function applyEditorSettings() {
  editor.style.tabSize = String(settings.tabSize);
}

applyWordWrap();
applyBrWrap();

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    toggleWordWrap();
  }
});

function syncZoomSpeedUI() {
  zoomSpeedSlider.value = String(settings.zoomSpeed);
  zoomSpeedValue.textContent = settings.zoomSpeed.toFixed(2);
}
syncZoomSpeedUI();
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

const settingsPanel = createSettingsPanel(settings, () => {
  applyEditorSettings();
  syncZoomSpeedUI();
});
btnSettings.addEventListener('click', () => settingsPanel.open());

// Open .mmd / .txt file
btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editor.value = await file.text();
  updateHighlight();
  updateGutter();
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

// Pan/zoom on right panel.
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

// Load saved diagram, else default
const saved = localStorage.getItem(STORAGE_KEY);
editor.value = saved !== null ? saved : `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

updateHighlight();
updateGutter();
applyTransform();
renderDiagram();
