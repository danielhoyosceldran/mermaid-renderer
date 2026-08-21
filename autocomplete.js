// Autocomplete popup for the Mermaid <textarea>.
//
// A textarea gives no caret coordinates, so a hidden mirror div is styled to
// match the textarea exactly; the text up to the caret is copied into it and a
// marker span is measured. Keydown handling must be registered before
// attachEditor() so the popup can claim Tab/Enter/arrows while it is open.

import { detectDiagramType, completionsFor } from './mermaid-completions.js';

const MAX_ITEMS = 12;
// Typing pops the list open only from this prefix length; Ctrl+Space ignores it.
const MIN_PREFIX = 2;

// Properties copied to the mirror so its line wrapping matches the textarea.
const MIRROR_PROPS = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
  'textTransform', 'textIndent', 'whiteSpace', 'wordWrap', 'wordBreak', 'tabSize',
];

/** Viewport coordinates of the caret, plus the current line height. */
function caretRect(textarea) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  for (const prop of MIRROR_PROPS) mirror.style[prop] = style[prop];
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.height = 'auto';

  const pos = textarea.selectionStart;
  mirror.textContent = textarea.value.slice(0, pos);
  const marker = document.createElement('span');
  // A zero-width space keeps the span from collapsing at end-of-line.
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerTop = marker.offsetTop;
  const markerLeft = marker.offsetLeft;
  const lineHeight = parseFloat(style.lineHeight) || marker.offsetHeight || 16;
  document.body.removeChild(mirror);

  const box = textarea.getBoundingClientRect();
  return {
    left: box.left + markerLeft - textarea.scrollLeft,
    top: box.top + markerTop - textarea.scrollTop,
    lineHeight,
  };
}

/** Word or arrow token immediately before the caret. */
function prefixAt(text, pos) {
  const before = text.slice(0, pos);
  const word = before.match(/[A-Za-z_%<][\w<>%-]*$/);
  if (word) return { text: word[0], start: pos - word[0].length, kind: 'word' };
  const arrow = before.match(/[-=.~|<>ox*]+$/);
  if (arrow) return { text: arrow[0], start: pos - arrow[0].length, kind: 'arrow' };
  return { text: '', start: pos, kind: 'word' };
}

/**
 * Score a candidate against `prefix`: exact prefix beats word-boundary match,
 * which beats a plain substring. Returns -1 when it does not match at all.
 */
function score(label, prefix) {
  if (!prefix) return 0;
  const l = label.toLowerCase();
  const p = prefix.toLowerCase();
  if (l.startsWith(p)) return 300 - label.length;
  const idx = l.indexOf(p);
  if (idx === -1) return -1;
  const boundary = /[\s\-_[({|]/.test(l[idx - 1] || '');
  return (boundary ? 200 : 100) - idx - label.length * 0.01;
}

export function attachAutocomplete(textarea, onChange, getSettings) {
  const popup = document.createElement('div');
  popup.id = 'autocomplete';
  popup.setAttribute('role', 'listbox');
  popup.hidden = true;
  document.body.appendChild(popup);

  let items = [];
  let index = 0;
  let prefix = null;
  let open = false;
  // Set when the popup was opened explicitly (Ctrl+Space); such a popup is not
  // closed by an empty prefix.
  let manual = false;

  function close() {
    if (!open) return;
    open = false;
    manual = false;
    popup.hidden = true;
    popup.innerHTML = '';
  }

  function render() {
    popup.innerHTML = '';
    items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'ac-item' + (i === index ? ' selected' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === index));

      const label = document.createElement('span');
      label.className = 'ac-label';
      label.textContent = item.label;
      row.appendChild(label);

      if (item.detail) {
        const detail = document.createElement('span');
        detail.className = 'ac-detail';
        detail.textContent = item.detail;
        row.appendChild(detail);
      }

      // mousedown, not click: click fires after the textarea loses focus.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        index = i;
        accept();
      });
      popup.appendChild(row);
    });

    const selected = popup.children[index];
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  function position() {
    const { left, top, lineHeight } = caretRect(textarea);
    popup.style.visibility = 'hidden';
    popup.hidden = false;
    const height = popup.offsetHeight;
    const width = popup.offsetWidth;

    // Flip above the caret when there is no room below.
    const below = top + lineHeight;
    const fitsBelow = below + height <= window.innerHeight - 8;
    popup.style.top = (fitsBelow ? below : Math.max(8, top - height)) + 'px';
    popup.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + 'px';
    popup.style.visibility = 'visible';
  }

  function refresh(explicit = false) {
    if (!explicit && getSettings && !getSettings().suggestions) {
      close();
      return;
    }
    prefix = prefixAt(textarea.value, textarea.selectionStart);
    if (!explicit && !open && prefix.text.length < MIN_PREFIX) {
      close();
      return;
    }
    if (!prefix.text && !explicit && !manual) {
      close();
      return;
    }
    if (explicit) manual = true;

    const type = detectDiagramType(textarea.value);
    const candidates = completionsFor(textarea.value, type, prefix.kind);

    items = candidates
      .map((item) => ({ item, s: score(item.label, prefix.text) }))
      .filter(({ s }) => s >= 0)
      // Sort is stable, so equal scores keep the table's declaration order.
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_ITEMS)
      .map(({ item }) => item);

    // Nothing useful to add when the only hit is what is already typed.
    if (!items.length || (items.length === 1 && items[0].label === prefix.text)) {
      close();
      return;
    }

    index = 0;
    open = true;
    render();
    position();
  }

  function accept() {
    if (!open || !items[index]) return;
    const item = items[index];
    const lineStart = textarea.value.lastIndexOf('\n', prefix.start - 1) + 1;
    const indent = (textarea.value.slice(lineStart, prefix.start).match(/^[ \t]*/) || [''])[0];

    // Continuation lines of a snippet inherit the current line's indentation.
    let text = item.insert.split('\n').join('\n' + indent);
    let caret = text.indexOf('$0');
    if (caret === -1) {
      caret = text.length;
    } else {
      text = text.replace('$0', '');
    }

    const from = prefix.start;
    const to = textarea.selectionEnd;
    textarea.focus();
    textarea.setSelectionRange(from, to);
    if (!document.execCommand('insertText', false, text)) {
      textarea.setRangeText(text, from, to, 'end');
    }
    textarea.setSelectionRange(from + caret, from + caret);
    close();
    if (onChange) onChange();
  }

  // --- events -----------------------------------------------------------

  textarea.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === ' ') {
      e.preventDefault();
      e.stopImmediatePropagation();
      refresh(true);
      return;
    }

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopImmediatePropagation();
        index = (index + 1) % items.length;
        render();
        return;
      case 'ArrowUp':
        e.preventDefault();
        e.stopImmediatePropagation();
        index = (index - 1 + items.length) % items.length;
        render();
        return;
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        e.stopImmediatePropagation();
        accept();
        return;
      case 'Escape':
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End':
        close();
        return;
      default:
        return;
    }
  });

  // Runs after the value has changed, unlike keydown.
  textarea.addEventListener('input', () => refresh());

  textarea.addEventListener('blur', close);
  textarea.addEventListener('scroll', () => {
    if (open) position();
  });
  window.addEventListener('resize', close);

  return { refresh: () => refresh(true), close };
}
