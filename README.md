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
| `Ctrl/Cmd + S` | Save to browser storage (the editor also autosaves) |
| `Ctrl/Cmd + Shift + S` | Save code as `diagram.mmd` |
| `Ctrl/Cmd + Space` | Open completions |
| `Tab` / `Enter` | Accept the highlighted completion |
| `Alt + Z` | Toggle word wrap |
| `Alt + Enter` | Insert `<br>` at the caret |
| `Ctrl/Cmd + F` | Find / replace |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Y` | Undo / redo |

Everything under Settings → Shortcuts is rebindable (duplicate line, move line,
comment, delete line, indent/outdent, …). The toolbar also has `Wrap`,
`<br> wrap` (renders `<br>` as a visual line break, display only) and
`Suggestions` toggles.
