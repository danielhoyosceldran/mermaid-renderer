// "What's new" release notes.
//
// release-notes.json holds the releases newest-first. Two localStorage keys
// track reading state: the version last read, and the latest one seen on disk.
// Anything above the last-read entry in the list counts as unread, so adding a
// release to the top of the file is all it takes to notify existing users.

const LS_LAST_READ = 'mermaid-renderer:release-notes-last-seen';
const LS_LATEST = 'mermaid-renderer:release-notes-latest-available';

function readLastRead() {
  try {
    return localStorage.getItem(LS_LAST_READ);
  } catch {
    return null;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Reading state is a convenience; failing to store it must not break the app.
  }
}

/** Releases newer than the last one the user read. */
function unreadFrom(releases) {
  const lastRead = readLastRead();
  if (!lastRead) return releases;
  const index = releases.findIndex((release) => release.version === lastRead);
  // An unknown version means the notes were rewritten: treat everything as new.
  return index === -1 ? releases : releases.slice(0, index);
}

function renderList(container, releases) {
  container.innerHTML = '';
  for (const release of releases) {
    const entry = document.createElement('div');
    entry.className = 'release-entry';

    const head = document.createElement('div');
    head.className = 'release-head';

    const version = document.createElement('span');
    version.className = 'release-version';
    version.textContent = 'v' + release.version;

    const date = document.createElement('span');
    date.className = 'release-date';
    date.textContent = release.date;

    head.append(version, date);

    const notes = document.createElement('ul');
    notes.className = 'release-notes';
    for (const note of release.notes || []) {
      const item = document.createElement('li');
      item.textContent = note;
      notes.appendChild(item);
    }

    entry.append(head, notes);
    container.appendChild(entry);
  }
}

/**
 * button: the toolbar bell. Its unread dot is toggled here.
 * Returns { isOpen, togglePanel, close }.
 */
export function createReleaseNotes({ button }) {
  const panel = document.createElement('div');
  panel.id = 'release-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="release-panel-header">
      <span>What's new</span>
      <button class="modal-close" title="Close">&times;</button>
    </div>
    <div class="release-list"></div>
  `;
  document.body.appendChild(panel);

  const overlay = document.createElement('div');
  overlay.id = 'release-overlay';
  overlay.className = 'modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-label="What's new">
      <div class="modal-header">
        <h2>What's new</h2>
        <button class="modal-close" title="Close">&times;</button>
      </div>
      <div class="modal-body release-list"></div>
      <div class="modal-footer">
        <button class="modal-button primary release-got-it">Got it</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const panelList = panel.querySelector('.release-list');
  const overlayList = overlay.querySelector('.release-list');
  const dialog = overlay.querySelector('.modal-dialog');

  let releases = [];
  let hasUnread = false;

  function updateDot() {
    button.classList.toggle('has-unread', hasUnread);
  }

  function markAllRead() {
    const latest = releases[0];
    if (!latest) return;
    remember(LS_LAST_READ, latest.version);
    hasUnread = false;
    updateDot();
  }

  function closeModal() {
    overlay.hidden = true;
    markAllRead();
  }

  function closePanel() {
    panel.hidden = true;
  }

  function togglePanel() {
    if (!releases.length) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      renderList(panelList, releases);
      // Position under the bell, kept inside the window.
      const box = button.getBoundingClientRect();
      panel.style.top = box.bottom + 8 + 'px';
      panel.style.right = Math.max(8, window.innerWidth - box.right) + 'px';
      markAllRead();
    }
  }

  panel.querySelector('.modal-close').addEventListener('click', closePanel);
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);
  overlay.querySelector('.release-got-it').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => {
    if (!dialog.contains(e.target)) closeModal();
  });

  document.addEventListener('mousedown', (e) => {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && !button.contains(e.target)) closePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay.hidden) {
      e.preventDefault();
      closeModal();
    } else if (!panel.hidden) {
      e.preventDefault();
      closePanel();
    }
  });

  window.addEventListener('resize', closePanel);
  button.addEventListener('click', togglePanel);

  async function load() {
    let data;
    try {
      const response = await fetch('release-notes.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      data = await response.json();
    } catch {
      // No notes available (offline, or opened without a server): hide the bell.
      button.hidden = true;
      return;
    }
    if (!Array.isArray(data) || !data.length) {
      button.hidden = true;
      return;
    }

    releases = data;
    remember(LS_LATEST, releases[0].version);

    const unread = unreadFrom(releases);
    hasUnread = unread.length > 0;
    updateDot();

    // Show what is new on load, and only what is new.
    if (hasUnread) {
      renderList(overlayList, unread);
      overlay.hidden = false;
    }
  }

  load();

  return {
    isOpen: () => !overlay.hidden || !panel.hidden,
    togglePanel,
    close() {
      closePanel();
      if (!overlay.hidden) closeModal();
    },
  };
}
