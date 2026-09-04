# Mermaid Renderer

Local offline Mermaid diagram renderer. Two-panel layout: editor left, diagram right.

The editor is CodeMirror 6 with a Mermaid mode written for this project
(`mermaid-language.js`) and Mermaid-aware completions (`mermaid-completions.js`).
There is no build step: `npm run vendor` copies mermaid and the CodeMirror ESM
files into `vendor/`, and `index.html` declares an import map that resolves the
`@codemirror/*` specifiers onto those copies.

## Setup

```bash
npm install     # runs `npm run vendor` afterwards
```

To re-vendor after changing dependency versions:

```bash
npm run vendor
```

## Run

ESM modules require a local server (not `file://`), and it must serve `.js`
with a JavaScript MIME type:

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:3000` (or whichever port).

## Shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd + Enter` | Recompile now |
| `Ctrl/Cmd + S` | Save; names the document the first time |
| `Ctrl/Cmd + O` | Documents manager |
| `Ctrl/Cmd + Shift + S` | Save code as `diagram.mmd` |
| `Ctrl/Cmd + Space` | Open completions |
| `Tab` / `Enter` | Accept the highlighted completion |
| `Alt + Z` | Toggle word wrap |
| `Alt + Enter` | Insert `<br>` at the caret |
| `Ctrl/Cmd + F` | Find / replace |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Y` | Undo / redo |

## Documents

Diagrams live in the browser, not on disk. A fresh diagram starts as
**Untitled** and is autosaved continuously. The first `Ctrl+S` asks for a name;
from then on both autosave and `Ctrl+S` write to that named document. The
document chip in the toolbar shows the current name (with a dot while there are
unsaved keystrokes) and opens the manager, as does `Ctrl+O`: from there you can
create, open, rename, duplicate and delete documents. `Import` brings a `.mmd`
file in as a new untitled document without touching the one you have open, and
`Ctrl+Shift+S` exports the current one back to disk.

Each tab remembers its own open document, so two tabs can edit two diagrams
side by side. A tab with no memory of one (a brand new tab) opens the most
recently updated document.

### Storage layout

Two `localStorage` keys per document, and no shared index:

```
mermaid-renderer:doc:<id>     the text
mermaid-renderer:meta:<id>    {name, createdAt, updatedAt, rev, size}
sessionStorage
  mermaid-renderer:active     the document THIS tab has open
```

There is deliberately no index document listing every diagram. Chromium caches
`localStorage` per renderer process and refreshes a tab's cache from the
`storage` event, so a tab reacting to another tab's write can still read a
stale value for a key whose event it has not processed yet. With a shared
index, a read-modify-write from inside an event handler would write that stale
snapshot back and silently undo the other tab's save. Per-document keys mean a
write can only ever affect its own document, and the document list is a cheap
key scan instead.

The rest of the safety net:

* The body is written before its metadata, so an interrupted save leaves a body
  with no metadata — which is re-registered as a `Recovered` document on the
  next load rather than lost. Metadata whose body is gone is dropped.
* Each document carries a `rev`. If another tab saved since this tab last did,
  autosave stands down instead of overwriting and `Ctrl+S` asks whether to keep
  yours, keep theirs, or save a copy.
* If another tab deletes the open document, `Ctrl+S` saves the text again as a
  new document instead of failing.
* When the browser refuses to store (quota, private mode), the editor says so
  and keeps the text; `Ctrl+Shift+S` is the way out to a file.

## Release notes

[release-notes.json](release-notes.json) holds the releases, newest first:

```json
[
  { "version": "1", "date": "2026-09-04", "notes": ["...", "..."] }
]
```

The bell in the toolbar opens the full history and carries a dot while there is
something unread. On load, anything newer than the last release the user read
is shown once in a popup. Two `localStorage` keys track that:
`mermaid-renderer:release-notes-last-seen` (the version last read) and
`mermaid-renderer:release-notes-latest-available` (the newest one on disk).
Unread means "above the last-read entry in the list", so **publishing a release
is just prepending an entry to the JSON** — no version comparison is involved,
and a rewritten file with unknown versions simply shows everything as new. If
the file cannot be fetched the bell hides itself and the app carries on.

Everything under Settings → Shortcuts is rebindable (duplicate line, move line,
comment, delete line, indent/outdent, …). The toolbar also has `Wrap`,
`<br> wrap` (renders `<br>` as a visual line break, display only) and
`Suggestions` toggles.
