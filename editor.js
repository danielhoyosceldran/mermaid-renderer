// Code-editor behaviours for a plain <textarea>: indentation, line ops,
// comment toggling and a fully rebindable keymap persisted in localStorage.

const SETTINGS_KEY = 'mermaid-renderer:editor-settings';

export const DEFAULT_SETTINGS = {
  tabSize: 2,
  insertSpaces: true,
  autoIndent: true,
  commentToken: '%%',
  keymap: {
    duplicateLine: 'ctrl+d',
    indent: 'tab',
    outdent: 'shift+tab',
    moveLineUp: 'alt+arrowup',
    moveLineDown: 'alt+arrowdown',
    newLineBelow: 'shift+enter',
    commentLine: 'alt+q',
    uncommentLine: 'alt+shift+q',
    toggleComment: 'ctrl+/',
    deleteLine: 'ctrl+shift+k',
    selectLine: 'ctrl+l',
    copyLineUp: 'ctrl+shift+arrowup',
    copyLineDown: 'ctrl+shift+arrowdown',
    smartHome: 'home',
    deleteWordLeft: 'ctrl+backspace',
  },
};

// Labels shown in the settings panel
export const COMMAND_LABELS = {
  duplicateLine: 'Duplicate line',
  indent: 'Indent',
  outdent: 'Outdent',
  moveLineUp: 'Move line up',
  moveLineDown: 'Move line down',
  newLineBelow: 'New line (ignore cursor position)',
  commentLine: 'Comment line',
  uncommentLine: 'Uncomment line',
  toggleComment: 'Toggle comment',
  deleteLine: 'Delete line',
  selectLine: 'Select line',
  copyLineUp: 'Copy line up',
  copyLineDown: 'Copy line down',
  smartHome: 'Home (first non-space, then column 0)',
  deleteWordLeft: 'Delete word left',
};

export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    stored = {};
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    keymap: { ...DEFAULT_SETTINGS.keymap, ...(stored.keymap || {}) },
  };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Canonical string for a keydown event, e.g. "ctrl+shift+arrowup". */
export function eventToCombo(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';
  if (['control', 'alt', 'shift', 'meta'].includes(key)) return null;
  parts.push(key);
  return parts.join('+');
}

export function formatCombo(combo) {
  return combo
    .split('+')
    .map((p) => {
      if (p === 'arrowup') return '↑';
      if (p === 'arrowdown') return '↓';
      if (p === 'arrowleft') return '←';
      if (p === 'arrowright') return '→';
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' + ');
}

export function attachEditor(textarea, getSettings, onChange) {
  // --- primitives -------------------------------------------------------

  // execCommand keeps the browser's native undo stack alive, unlike
  // direct .value assignment.
  function replaceRange(start, end, text, selStart, selEnd) {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) {
      textarea.setRangeText(text, start, end, 'end');
    }
    if (selStart !== undefined) {
      textarea.setSelectionRange(selStart, selEnd === undefined ? selStart : selEnd);
    }
    if (onChange) onChange();
  }

  function lineStartAt(pos) {
    return textarea.value.lastIndexOf('\n', pos - 1) + 1;
  }

  function lineEndAt(pos) {
    const i = textarea.value.indexOf('\n', pos);
    return i === -1 ? textarea.value.length : i;
  }

  /** Full-line block covering the current selection. */
  function selectedBlock() {
    const start = lineStartAt(textarea.selectionStart);
    const end = lineEndAt(textarea.selectionEnd);
    return { start, end, text: textarea.value.slice(start, end) };
  }

  function indentUnit() {
    const s = getSettings();
    return s.insertSpaces ? ' '.repeat(s.tabSize) : '\t';
  }

  function leadingWhitespace(line) {
    return (line.match(/^[ \t]*/) || [''])[0];
  }

  // --- commands ---------------------------------------------------------

  const commands = {
    duplicateLine() {
      const { start, end, text } = selectedBlock();
      const caretOffset = textarea.selectionStart - start;
      const added = text.length + 1;
      replaceRange(start, end, text + '\n' + text, start + added + caretOffset);
    },

    indent() {
      const unit = indentUnit();
      const { selectionStart, selectionEnd } = textarea;
      // No selection: insert the unit at the caret (aligned to tab stops).
      if (selectionStart === selectionEnd) {
        const s = getSettings();
        if (s.insertSpaces) {
          const col = selectionStart - lineStartAt(selectionStart);
          const width = s.tabSize - (col % s.tabSize);
          replaceRange(selectionStart, selectionStart, ' '.repeat(width));
        } else {
          replaceRange(selectionStart, selectionStart, '\t');
        }
        return;
      }
      const { start, end, text } = selectedBlock();
      const out = text.split('\n').map((l) => unit + l).join('\n');
      replaceRange(start, end, out, start, start + out.length);
    },

    outdent() {
      const s = getSettings();
      const { start, end, text } = selectedBlock();
      const collapsed = textarea.selectionStart === textarea.selectionEnd;
      let firstRemoved = 0;
      const out = text
        .split('\n')
        .map((l, i) => {
          let removed = 0;
          if (l.startsWith('\t')) {
            removed = 1;
          } else {
            while (removed < s.tabSize && l[removed] === ' ') removed++;
          }
          if (i === 0) firstRemoved = removed;
          return l.slice(removed);
        })
        .join('\n');
      if (out === text) return;
      if (collapsed) {
        const caret = Math.max(start, textarea.selectionStart - firstRemoved);
        replaceRange(start, end, out, caret);
      } else {
        replaceRange(start, end, out, start, start + out.length);
      }
    },

    moveLineUp() {
      const { start, end, text } = selectedBlock();
      if (start === 0) return;
      const prevStart = lineStartAt(start - 1);
      const prev = textarea.value.slice(prevStart, start - 1);
      const selOffsetStart = textarea.selectionStart - start;
      const selOffsetEnd = textarea.selectionEnd - start;
      replaceRange(
        prevStart,
        end,
        text + '\n' + prev,
        prevStart + selOffsetStart,
        prevStart + selOffsetEnd
      );
    },

    moveLineDown() {
      const { start, end, text } = selectedBlock();
      if (end >= textarea.value.length) return;
      const nextEnd = lineEndAt(end + 1);
      const next = textarea.value.slice(end + 1, nextEnd);
      const selOffsetStart = textarea.selectionStart - start;
      const selOffsetEnd = textarea.selectionEnd - start;
      const newStart = start + next.length + 1;
      replaceRange(
        start,
        nextEnd,
        next + '\n' + text,
        newStart + selOffsetStart,
        newStart + selOffsetEnd
      );
    },

    copyLineUp() {
      const { start, end, text } = selectedBlock();
      const caretOffset = textarea.selectionStart - start;
      replaceRange(start, end, text + '\n' + text, start + caretOffset);
    },

    copyLineDown() {
      commands.duplicateLine();
    },

    newLineBelow() {
      const s = getSettings();
      const start = lineStartAt(textarea.selectionStart);
      const end = lineEndAt(textarea.selectionEnd);
      const indent = s.autoIndent
        ? leadingWhitespace(textarea.value.slice(start, end))
        : '';
      replaceRange(end, end, '\n' + indent, end + 1 + indent.length);
    },

    commentLine() {
      const token = getSettings().commentToken;
      const { start, end, text } = selectedBlock();
      const lines = text.split('\n');
      // Align the token at the shallowest indentation of the block.
      const indent = lines
        .filter((l) => l.trim())
        .reduce((min, l) => {
          const w = leadingWhitespace(l);
          return min === null || w.length < min.length ? w : min;
        }, null) ?? '';
      const out = lines
        .map((l) => (l.trim() ? indent + token + ' ' + l.slice(indent.length) : l))
        .join('\n');
      replaceRange(start, end, out, start, start + out.length);
    },

    uncommentLine() {
      const token = getSettings().commentToken;
      const { start, end, text } = selectedBlock();
      const out = text
        .split('\n')
        .map((l) => {
          const w = leadingWhitespace(l);
          const rest = l.slice(w.length);
          if (!rest.startsWith(token)) return l;
          let body = rest.slice(token.length);
          if (body.startsWith(' ')) body = body.slice(1);
          return w + body;
        })
        .join('\n');
      if (out === text) return;
      replaceRange(start, end, out, start, start + out.length);
    },

    toggleComment() {
      const token = getSettings().commentToken;
      const { text } = selectedBlock();
      const allCommented = text
        .split('\n')
        .filter((l) => l.trim())
        .every((l) => l.trimStart().startsWith(token));
      if (allCommented) commands.uncommentLine();
      else commands.commentLine();
    },

    deleteLine() {
      const { start, end } = selectedBlock();
      const hasNext = end < textarea.value.length;
      const from = hasNext ? start : Math.max(0, start - 1);
      const to = hasNext ? end + 1 : end;
      replaceRange(from, to, '', Math.min(from, textarea.value.length));
    },

    selectLine() {
      const { start, end } = selectedBlock();
      const to = end < textarea.value.length ? end + 1 : end;
      textarea.setSelectionRange(start, to);
    },

    smartHome() {
      const pos = textarea.selectionStart;
      const start = lineStartAt(pos);
      const line = textarea.value.slice(start, lineEndAt(pos));
      const firstNonSpace = start + leadingWhitespace(line).length;
      textarea.setSelectionRange(
        pos === firstNonSpace ? start : firstNonSpace,
        pos === firstNonSpace ? start : firstNonSpace
      );
    },

    deleteWordLeft() {
      const pos = textarea.selectionStart;
      if (pos !== textarea.selectionEnd) {
        replaceRange(pos, textarea.selectionEnd, '');
        return;
      }
      if (pos === 0) return false;
      const before = textarea.value.slice(0, pos);
      const match = before.match(/(\s*[\w$-]+|\s+|.)$/);
      if (!match) return false;
      replaceRange(pos - match[0].length, pos, '');
    },

    // Not rebindable: plain Enter keeps the current indentation level.
    autoIndentEnter() {
      const s = getSettings();
      if (!s.autoIndent) return false;
      const start = lineStartAt(textarea.selectionStart);
      const line = textarea.value.slice(start, textarea.selectionStart);
      const indent = leadingWhitespace(line);
      if (!indent) return false;
      replaceRange(
        textarea.selectionStart,
        textarea.selectionEnd,
        '\n' + indent
      );
    },
  };

  // --- dispatch ---------------------------------------------------------

  textarea.addEventListener('keydown', (e) => {
    const combo = eventToCombo(e);
    if (!combo) return;
    const { keymap } = getSettings();

    for (const [name, binding] of Object.entries(keymap)) {
      if (binding && binding === combo && commands[name]) {
        e.preventDefault();
        if (commands[name]() === false) {
          // Command declined: fall through would need a synthetic event,
          // so nothing happens. Only used by no-op guards.
        }
        return;
      }
    }

    if (combo === 'enter') {
      if (commands.autoIndentEnter() !== false) e.preventDefault();
    }
  });

  return commands;
}
