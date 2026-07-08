import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';

mermaid.initialize({ startOnLoad: false });

const editor = document.getElementById('editor');
const output = document.getElementById('output');
const splitter = document.getElementById('splitter');
const btnOpen = document.getElementById('btn-open');
const fileInput = document.getElementById('file-input');
const leftPanel = document.getElementById('left-panel');
const main = document.getElementById('main');

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
editor.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderDiagram, 400);
});

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
});

document.addEventListener('mouseup', () => {
  dragging = false;
});

// Default diagram on load
editor.value = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

renderDiagram();
