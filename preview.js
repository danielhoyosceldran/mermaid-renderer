import mermaid from './vendor/mermaid/mermaid.esm.min.mjs';

// Pinned for the same reason as in app.js: the SVG is injected with innerHTML.
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

const output = document.getElementById('output');
const viewport = document.getElementById('viewport');

let renderId = 0;

async function renderDiagram(code) {
  code = code.trim();
  if (!code) {
    output.innerHTML = '';
    return;
  }
  const id = 'mermaid-preview-' + (++renderId);
  try {
    const { svg } = await mermaid.render(id, code);
    output.innerHTML = svg;
    fitToWidth();
  } catch (err) {
    const orphan = document.getElementById(id);
    if (orphan) orphan.remove();
    output.textContent = err && err.message ? err.message : String(err);
  }
}

let zoom = 1;
let panX = 0;
let panY = 0;
let baseScale = 1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;

function applyTransform() {
  const scale = baseScale * zoom;
  output.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function fitToWidth() {
  const svg = output.querySelector('svg');
  const naturalWidth = svg ? svg.getBoundingClientRect().width / (baseScale * zoom) : 0;
  const viewportWidth = viewport.clientWidth;
  baseScale = naturalWidth > 0 ? viewportWidth / naturalWidth : 1;
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
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(factor, e.clientX, e.clientY);
    return;
  }
  panX -= e.deltaX;
  panY -= e.deltaY;
  applyTransform();
}, { passive: false });

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

window.addEventListener('resize', fitToWidth);

const channel = new BroadcastChannel('mermaid-live');
channel.onmessage = (e) => {
  if (e.data && typeof e.data.code === 'string') renderDiagram(e.data.code);
};
channel.postMessage({ type: 'request-sync' });
