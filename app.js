import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';
import { loadSettings, saveSettings } from './editor.js';
import { createSettingsPanel } from './settings-panel.js';
import { createEditor } from './cm-editor.js';
import * as store from './doc-store.js';
import { createDocsPanel } from './docs-panel.js';
import { askChoice, askText, isDialogOpen } from './dialogs.js';
import { createReleaseNotes } from './release-notes.js';

// securityLevel is pinned rather than left to mermaid's default, because the
// rendered SVG is injected with innerHTML below.
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const editorHost = document.getElementById('editor-host');
const docNameButton = document.getElementById('doc-name');
const docNameText = document.getElementById('doc-name-text');
const docDirtyDot = document.getElementById('doc-dirty');
const btnImport = document.getElementById('btn-import');
const btnSettings = document.getElementById('btn-settings');
const btnWrap = document.getElementById('btn-wrap');
const btnBrWrap = document.getElementById('btn-br-wrap');
const btnSuggestions = document.getElementById('btn-suggestions');
const output = document.getElementById('output');
const splitter = document.getElementById('splitter');
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
const btnWhatsNew = document.getElementById('btn-whats-new');

const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

const settings = loadSettings();

// --- active document ---------------------------------------------------------

// The editor always edits one stored document. `savedText` and `savedRev` are
// what storage last confirmed, so "dirty" is a comparison and never a guess.
let currentMeta;
let savedText;
let savedRev;
// Set when storage moved ahead of us (another tab). Autosave stands down until
// the user resolves it, so a background write can never clobber their work.
let conflicted = false;
// Set when another tab deleted this document. Autosave stands down rather than
// resurrecting it behind the user's back; Ctrl+S saves it again.
let missing = false;
// Remembered from an import, to prefill the name dialog on the first save.
let suggestedName = null;

function resolveInitialDocument() {
  // Older layouts first, so their documents keep their names instead of being
  // rescued as "Recovered" by the sweep that follows.
  store.migrateLegacy();
  store.recover();

  const activeId = store.activeId();
  let doc = activeId ? store.get(activeId) : null;
  if (!doc) {
    const mostRecent = store.list()[0];
    doc = mostRecent ? store.get(mostRecent.id) : null;
  }
  if (!doc) {
    const meta = store.create({ name: null, text: DEFAULT_DIAGRAM });
    doc = { meta, text: DEFAULT_DIAGRAM };
  }
  store.setActive(doc.meta.id);
  return doc;
}

const initial = resolveInitialDocument();
currentMeta = initial.meta;
savedText = initial.text;
savedRev = initial.meta.rev;

// --- editor ------------------------------------------------------------------

const editor = createEditor({
  parent: editorHost,
  doc: initial.text,
  getSettings: () => settings,
  onChange: onEditorChange,
  placeholder: 'Enter Mermaid diagram code...',
});

function onEditorChange() {
  scheduleRender();
  scheduleAutosave();
  updateDocChip();
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

const releaseNotes = createReleaseNotes({ button: btnWhatsNew });

btnPopout.addEventListener('click', () => {
  window.open('preview.html', 'mermaid-preview', 'width=800,height=600');
});

// --- persistence -------------------------------------------------------------

const AUTOSAVE_DELAY = 800;

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(autosave, AUTOSAVE_DELAY);
}

function isDirty() {
  return editor.getValue() !== savedText;
}

/** Persist the editor's text into the active document. */
function writeActive({ force = false } = {}) {
  clearTimeout(autosaveTimer);
  const text = editor.getValue();

  // Deleted from another tab: save the text again under a new document rather
  // than reporting a conflict against something that no longer exists.
  if (missing || !store.get(currentMeta.id)) {
    try {
      const meta = store.create({
        name: currentMeta.name ? store.uniqueName(currentMeta.name) : null,
        text,
      });
      missing = false;
      conflicted = false;
      currentMeta = meta;
      savedText = text;
      savedRev = meta.rev;
      updateDocChip();
      docsPanel.refresh();
      return 'saved';
    } catch (err) {
      showToast(
        err instanceof store.QuotaError
          ? 'Browser storage is full — use Ctrl+Shift+S to export this diagram to a file'
          : 'Could not save: ' + (err && err.message ? err.message : err)
      );
      return err instanceof store.QuotaError ? 'quota' : 'error';
    }
  }

  try {
    const meta = store.save(currentMeta.id, text, { baseRev: savedRev, force });
    savedText = text;
    savedRev = meta.rev;
    currentMeta = meta;
    conflicted = false;
    updateDocChip();
    docsPanel.refresh();
    return 'saved';
  } catch (err) {
    if (err instanceof store.ConflictError) {
      conflicted = true;
      updateDocChip();
      return 'conflict';
    }
    if (err instanceof store.QuotaError) {
      showToast('Browser storage is full — use Ctrl+Shift+S to export this diagram to a file');
      return 'quota';
    }
    showToast('Could not save: ' + (err && err.message ? err.message : err));
    return 'error';
  }
}

function autosave() {
  // Never autosave over a document another tab has moved on, and never
  // resurrect one it deleted; the explicit Ctrl+S path asks the user.
  if (conflicted || missing || !isDirty()) return;
  const result = writeActive();
  if (result === 'conflict') {
    showToast('Changed in another tab — press Ctrl+S to resolve');
  }
}

function flush() {
  if (!conflicted && !missing && isDirty()) writeActive();
}

/** Ctrl+S: name the document if it is still untitled, then save. */
async function saveExplicit() {
  if (!currentMeta.name) {
    const name = await askText({
      title: 'Save document',
      message: 'Autosave will keep writing to this document from now on.',
      value: suggestedName || '',
      placeholder: 'Document name',
      confirmLabel: 'Save',
      validate: (text) => {
        if (!text.trim()) return 'Enter a name.';
        if (store.nameTaken(text, currentMeta.id)) return 'A document with that name already exists.';
        return null;
      },
    });
    if (name === null) return;
    try {
      const meta = store.rename(currentMeta.id, name);
      if (meta) {
        currentMeta = meta;
        savedRev = meta.rev;
      }
      suggestedName = null;
    } catch (err) {
      showToast(
        err instanceof store.QuotaError
          ? 'Browser storage is full — could not name this document'
          : 'Could not rename: ' + (err && err.message ? err.message : err)
      );
      return;
    }
  }

  // A conflict resolution is itself the save, so it reports its own outcome.
  if (conflicted && !missing) {
    await resolveConflict();
    return;
  }

  if (writeActive() === 'saved') showToast('Saved to “' + store.displayName(currentMeta) + '”');
}

/** Ask what to do when storage moved ahead of this tab, then act on it. */
async function resolveConflict() {
  const choice = await askChoice({
    title: 'Changed in another tab',
    message:
      '“' +
      store.displayName(currentMeta) +
      '” was modified elsewhere after you last saved here. Choose which version to keep.',
    options: [
      { label: 'Keep theirs', value: 'theirs' },
      { label: 'Save as copy', value: 'copy' },
      { label: 'Keep mine', value: 'mine', primary: true },
    ],
  });

  if (choice === 'mine') {
    // Force past the revision check; the user chose to overwrite.
    if (writeActive({ force: true }) === 'saved') {
      showToast('Saved to “' + store.displayName(currentMeta) + '”');
    }
    return;
  }

  if (choice === 'theirs') {
    const stored = store.get(currentMeta.id);
    if (stored) adoptDocument(stored, 'Reloaded from the other tab');
    return;
  }

  if (choice === 'copy') {
    try {
      const meta = store.create({
        name: store.uniqueName(store.displayName(currentMeta) + ' (copy)'),
        text: editor.getValue(),
      });
      currentMeta = meta;
      savedText = editor.getValue();
      savedRev = meta.rev;
      conflicted = false;
      updateDocChip();
      docsPanel.refresh();
      showToast('Saved as “' + store.displayName(meta) + '”');
    } catch (err) {
      showToast(
        err instanceof store.QuotaError
          ? 'Browser storage is full — use Ctrl+Shift+S to export this diagram to a file'
          : 'Could not save a copy: ' + (err && err.message ? err.message : err)
      );
    }
  }
}

/** Put a stored document into the editor and make it the active one. */
function adoptDocument({ meta, text }, toast) {
  clearTimeout(autosaveTimer);
  currentMeta = meta;
  savedText = text;
  savedRev = meta.rev;
  conflicted = false;
  missing = false;
  suggestedName = null;
  store.setActive(meta.id);
  editor.setValue(text);
  updateDocChip();
  docsPanel.refresh();
  renderDiagram();
  if (toast) showToast(toast);
}

function updateDocChip() {
  docNameText.textContent = store.displayName(currentMeta);
  docNameButton.classList.toggle('untitled', !currentMeta.name);
  docNameButton.classList.toggle('conflicted', conflicted || missing);
  docDirtyDot.hidden = !(isDirty() || conflicted || missing);
  docNameButton.title = missing
    ? 'Deleted in another tab — press Ctrl+S to save it again'
    : conflicted
      ? 'Changed in another tab — press Ctrl+S to resolve'
      : currentMeta.name
      ? store.displayName(currentMeta) + ' · Documents (Ctrl+O)'
      : 'Not saved under a name yet — Ctrl+S to name it';
}

const docsPanel = createDocsPanel({
  getActiveId: () => currentMeta.id,
  flush,
  notify: showToast,
  onMetaChanged: () => {
    const refreshed = store.list().find((m) => m.id === currentMeta.id);
    if (refreshed) currentMeta = refreshed;
    updateDocChip();
  },
  openDocument: (id) => {
    flush();
    const doc = store.get(id);
    if (!doc) {
      showToast('That document is no longer available');
      return;
    }
    adoptDocument(doc, 'Opened “' + store.displayName(doc.meta) + '”');
  },
  createDocument: () => {
    flush();
    try {
      const meta = store.create({ name: null, text: '' });
      adoptDocument({ meta, text: '' }, 'New document');
    } catch (err) {
      showToast(
        err instanceof store.QuotaError
          ? 'Browser storage is full — delete a document first'
          : 'Could not create a document: ' + (err && err.message ? err.message : err)
      );
    }
  },
  importFromFile: () => fileInput.click(),
});

docNameButton.addEventListener('click', () => docsPanel.open());
btnImport.addEventListener('click', () => fileInput.click());

// A save writes the body and then the metadata, so a watching tab sees two
// events, and while it processes the first one its cached copy of the other
// key can still be the old value. `meta.size` is the check that the two halves
// belong together; when they do not, the read is retried briefly.
const SYNC_RETRY_DELAY = 60;
const SYNC_RETRIES = 8;

let syncTimer;
let syncAttempt = 0;

/** Bring the editor back in line with what storage now holds. */
function syncActiveFromStorage(hintMeta) {
  clearTimeout(syncTimer);

  const stored = store.get(currentMeta.id);
  if (!stored) {
    missing = true;
    conflicted = false;
    updateDocChip();
    showToast('This document was deleted in another tab — Ctrl+S saves it again');
    return;
  }
  missing = false;

  // The event carries the metadata it changed, which beats a possibly stale
  // read of that key.
  const meta =
    hintMeta && hintMeta.id === currentMeta.id && hintMeta.rev > stored.meta.rev
      ? hintMeta
      : stored.meta;

  if (meta.rev <= savedRev) {
    // Only metadata moved — a rename in the manager, for instance.
    currentMeta = meta;
    updateDocChip();
    return;
  }

  if (isDirty() || conflicted) {
    // Never take their text while we hold unsaved edits; Ctrl+S decides.
    conflicted = true;
    currentMeta = meta;
    updateDocChip();
    showToast('Changed in another tab — press Ctrl+S to resolve');
    return;
  }

  if (stored.text.length !== meta.size && syncAttempt < SYNC_RETRIES) {
    syncAttempt++;
    syncTimer = setTimeout(() => syncActiveFromStorage(hintMeta), SYNC_RETRY_DELAY);
    return;
  }

  adoptDocument({ meta, text: stored.text }, 'Reloaded — changed in another tab');
}

// Another tab wrote to storage. Nothing in here may write: a write built on a
// stale read is exactly what would undo the other tab's save.
store.onExternalChange(({ id, kind, meta }) => {
  if (kind === 'cleared') {
    conflicted = true;
    updateDocChip();
    docsPanel.refresh();
    return;
  }

  if (id === currentMeta.id) {
    syncAttempt = 0;
    syncActiveFromStorage(meta);
  }

  docsPanel.refresh();
});

window.addEventListener('beforeunload', flush);

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

// Import a .mmd / .txt file from disk as a new untitled document, so it never
// overwrites whatever is currently open.
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  fileInput.value = '';
  if (!file) return;

  let text;
  try {
    text = await file.text();
  } catch (err) {
    showToast('Could not read file: ' + (err && err.message ? err.message : err));
    return;
  }

  flush();
  try {
    const meta = store.create({ name: null, text });
    adoptDocument({ meta, text }, 'Imported ' + file.name);
    // Ctrl+S will offer the file's name.
    suggestedName = file.name.replace(/\.[^.]+$/, '');
  } catch (err) {
    showToast(
      err instanceof store.QuotaError
        ? 'Browser storage is full — delete a document first'
        : 'Could not import: ' + (err && err.message ? err.message : err)
    );
  }
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
  // A modal owns the keyboard while it is up.
  if (isDialogOpen() || docsPanel.isOpen() || releaseNotes.isOpen()) return;

  // Check Shift+S before plain S
  if (e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveMermaid();
    return;
  }

  if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveExplicit();
    return;
  }

  if (e.key.toLowerCase() === 'o') {
    e.preventDefault();
    docsPanel.open();
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
updateDocChip();
applyTransform();
renderDiagram();
