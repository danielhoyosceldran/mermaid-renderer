# Mermaid Renderer

Local offline Mermaid diagram renderer. Two-panel layout: editor left, diagram right.

## Setup

```bash
npm install
mkdir -p vendor/mermaid
cp -r node_modules/mermaid/dist/* vendor/mermaid/
```

On Windows (PowerShell):
```powershell
npm install
New-Item -ItemType Directory -Force vendor\mermaid
Copy-Item node_modules\mermaid\dist\* vendor\mermaid\ -Recurse
```

## Run

ESM modules require a local server (not `file://`):

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
| `Ctrl/Cmd + Shift + S` | Save code as `diagram.mmd` |
| `Ctrl/Cmd + S` | Blocked (no browser save-page) |
