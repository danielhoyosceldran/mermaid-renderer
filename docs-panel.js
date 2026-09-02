// The "Documents" manager: list, open, rename, duplicate, delete.

import * as store from './doc-store.js';
import { askConfirm, askText } from './dialogs.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function relativeTime(timestamp) {
  if (!timestamp) return '';
  const delta = Date.now() - timestamp;
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return Math.floor(delta / MINUTE) + ' min ago';
  if (delta < DAY) {
    const hours = Math.floor(delta / HOUR);
    return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  }
  if (delta < 7 * DAY) {
    const days = Math.floor(delta / DAY);
    return days === 1 ? 'yesterday' : days + ' days ago';
  }
  return new Date(timestamp).toLocaleDateString();
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * host API:
 *   getActiveId()        the document currently loaded in the editor
 *   openDocument(id)     load it into the editor
 *   createDocument()     new untitled document, loaded into the editor
 *   importFromFile()     open the file picker
 *   flush()              persist pending edits before we touch storage
 *   notify(message)      toast
 */
export function createDocsPanel(host) {
  const overlay = document.createElement('div');
  overlay.id = 'docs-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div id="docs-dialog" class="modal-dialog" role="dialog" aria-label="Documents">
      <div class="modal-header">
        <h2>Documents</h2>
        <button class="modal-close" title="Close">&times;</button>
      </div>
      <div class="docs-toolbar">
        <button class="docs-new">New</button>
        <button class="docs-import">Import file…</button>
        <input class="docs-search" type="search" placeholder="Search…" spellcheck="false" aria-label="Search documents" />
      </div>
      <div class="modal-body">
        <div class="docs-list" role="listbox" tabindex="0" aria-label="Saved documents"></div>
        <p class="docs-empty" hidden>No saved documents yet. Press Ctrl+S to name the current one.</p>
      </div>
      <div class="modal-footer">
        <span class="docs-usage"></span>
        <button class="docs-rename">Rename</button>
        <button class="docs-duplicate">Duplicate</button>
        <button class="docs-delete danger">Delete</button>
        <button class="docs-open primary">Open</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('#docs-dialog');
  const listEl = overlay.querySelector('.docs-list');
  const emptyEl = overlay.querySelector('.docs-empty');
  const searchEl = overlay.querySelector('.docs-search');
  const usageEl = overlay.querySelector('.docs-usage');
  const btnOpen = overlay.querySelector('.docs-open');
  const btnRename = overlay.querySelector('.docs-rename');
  const btnDuplicate = overlay.querySelector('.docs-duplicate');
  const btnDelete = overlay.querySelector('.docs-delete');

  // The row highlighted in the list, which is not the document being edited.
  let selectedId = null;
  let visible = [];

  function isOpen() {
    return overlay.classList.contains('visible');
  }

  function render() {
    const query = searchEl.value.trim().toLowerCase();
    const activeId = host.getActiveId();
    visible = store
      .list()
      .filter((meta) => !query || store.displayName(meta).toLowerCase().includes(query));

    if (!visible.some((meta) => meta.id === selectedId)) {
      selectedId = visible.length ? (visible.find((m) => m.id === activeId) || visible[0]).id : null;
    }

    listEl.innerHTML = '';
    for (const meta of visible) {
      const row = document.createElement('div');
      row.className = 'docs-item';
      row.dataset.id = meta.id;
      row.setAttribute('role', 'option');
      if (meta.id === selectedId) row.classList.add('selected');
      if (meta.id === activeId) row.classList.add('current');
      row.setAttribute('aria-selected', String(meta.id === selectedId));

      const name = document.createElement('span');
      name.className = 'docs-name' + (meta.name ? '' : ' untitled');
      name.textContent = store.displayName(meta);
      if (meta.id === activeId) {
        const badge = document.createElement('span');
        badge.className = 'docs-badge';
        badge.textContent = 'open';
        name.appendChild(badge);
      }

      const time = document.createElement('span');
      time.className = 'docs-time';
      time.textContent = relativeTime(meta.updatedAt);
      time.title = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : '';

      const size = document.createElement('span');
      size.className = 'docs-size';
      size.textContent = formatBytes(meta.size * 2);

      row.append(name, time, size);
      row.addEventListener('click', () => {
        selectedId = meta.id;
        render();
      });
      row.addEventListener('dblclick', () => open(meta.id));
      listEl.appendChild(row);
    }

    const hasAny = store.list().length > 0;
    emptyEl.hidden = hasAny;
    listEl.hidden = !visible.length;
    if (hasAny && !visible.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'No document matches that search.';
    } else {
      emptyEl.textContent = 'No saved documents yet. Press Ctrl+S to name the current one.';
    }

    const selected = visible.find((m) => m.id === selectedId) || null;
    const isCurrent = selected && selected.id === activeId;
    btnOpen.disabled = !selected || isCurrent;
    btnRename.disabled = !selected;
    btnDuplicate.disabled = !selected;
    btnDelete.disabled = !selected;

    usageEl.textContent = `${store.list().length} document(s) · ${formatBytes(store.usage())} used`;

    const selectedRow = listEl.querySelector('.docs-item.selected');
    if (selectedRow) selectedRow.scrollIntoView({ block: 'nearest' });
  }

  async function open(id) {
    const meta = store.list().find((m) => m.id === id);
    if (!meta) {
      render();
      return;
    }
    if (id === host.getActiveId()) {
      close();
      return;
    }
    await host.openDocument(id);
    close();
  }

  async function renameSelected() {
    const meta = store.list().find((m) => m.id === selectedId);
    if (!meta) return;
    const name = await askText({
      title: 'Rename document',
      value: meta.name || '',
      placeholder: 'Document name',
      confirmLabel: 'Rename',
      validate: (text) => {
        if (!text.trim()) return 'Enter a name.';
        if (store.nameTaken(text, meta.id)) return 'A document with that name already exists.';
        return null;
      },
    });
    if (name === null) return;
    try {
      store.rename(meta.id, name);
      host.onMetaChanged();
      host.notify('Renamed');
    } catch (err) {
      host.notify(err instanceof store.QuotaError ? 'Could not rename: storage is full' : String(err.message || err));
    }
    render();
  }

  function duplicateSelected() {
    const meta = store.list().find((m) => m.id === selectedId);
    if (!meta) return;
    try {
      const copy = store.duplicate(meta.id);
      if (copy) {
        selectedId = copy.id;
        host.notify('Duplicated as “' + store.displayName(copy) + '”');
      }
    } catch (err) {
      host.notify(err instanceof store.QuotaError ? 'Could not duplicate: storage is full' : String(err.message || err));
    }
    render();
  }

  async function deleteSelected() {
    const meta = store.list().find((m) => m.id === selectedId);
    if (!meta) return;
    const isCurrent = meta.id === host.getActiveId();
    const confirmed = await askConfirm({
      title: 'Delete document',
      message:
        `“${store.displayName(meta)}” will be deleted from this browser. This cannot be undone.` +
        (isCurrent ? ' It is the document you are editing, so a new untitled one will be opened.' : ''),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    store.remove(meta.id);
    selectedId = null;
    if (isCurrent) await host.createDocument();
    else host.onMetaChanged();
    host.notify('Deleted');
    render();
  }

  async function createNew() {
    await host.createDocument();
    close();
  }

  overlay.querySelector('.modal-close').addEventListener('click', () => close());
  overlay.querySelector('.docs-new').addEventListener('click', createNew);
  overlay.querySelector('.docs-import').addEventListener('click', () => {
    close();
    host.importFromFile();
  });
  searchEl.addEventListener('input', render);
  btnOpen.addEventListener('click', () => selectedId && open(selectedId));
  btnRename.addEventListener('click', renameSelected);
  btnDuplicate.addEventListener('click', duplicateSelected);
  btnDelete.addEventListener('click', deleteSelected);

  overlay.addEventListener('mousedown', (e) => {
    if (!dialog.contains(e.target)) close();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (!visible.length) return;
    const at = visible.findIndex((m) => m.id === selectedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedId = visible[Math.min(visible.length - 1, at + 1)].id;
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedId = visible[Math.max(0, at - 1)].id;
      render();
    } else if (e.key === 'Enter' && document.activeElement !== searchEl) {
      e.preventDefault();
      if (selectedId) open(selectedId);
    }
  });

  function openPanel() {
    // Pending keystrokes must reach storage before the list shows timestamps.
    host.flush();
    selectedId = host.getActiveId();
    searchEl.value = '';
    overlay.classList.add('visible');
    render();
    listEl.focus();
  }

  function close() {
    overlay.classList.remove('visible');
  }

  return {
    open: openPanel,
    close,
    isOpen,
    refresh: () => {
      if (isOpen()) render();
    },
  };
}
