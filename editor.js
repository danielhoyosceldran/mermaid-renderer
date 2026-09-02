// Editor settings (persisted in localStorage) and the rebindable keymap that
// maps them onto CodeMirror commands.

import { EditorSelection, countColumn } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import {
  copyLineDown,
  copyLineUp,
  deleteGroupBackward,
  deleteLine,
  indentLess,
  indentMore,
  insertBlankLine,
  lineComment,
  lineUncomment,
  moveLineDown,
  moveLineUp,
  selectLine,
  toggleLineComment,
} from '@codemirror/commands';

const SETTINGS_KEY = 'mermaid-renderer:editor-settings';

export const DEFAULT_SETTINGS = {
  tabSize: 2,
  insertSpaces: true,
  autoIndent: true,
  commentToken: '%%',
  zoomSpeed: 0.1,
  wordWrap: true,
  brWrap: false,
  suggestions: true,
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
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; a full or blocked store must not break editing.
  }
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

// --- keymap ------------------------------------------------------------------

// KeyboardEvent.key values whose CodeMirror name differs from a plain
// capitalisation of the stored combo part.
const CM_KEY_NAMES = {
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  space: ' ',
};

/** "ctrl+shift+arrowup" -> "Mod-Shift-ArrowUp" */
function comboToKey(combo) {
  const parts = combo.split('+');
  const key = parts.pop();
  const mods = [];
  // eventToCombo folds Cmd into "ctrl", which is exactly CodeMirror's "Mod".
  if (parts.includes('ctrl')) mods.push('Mod');
  if (parts.includes('alt')) mods.push('Alt');
  if (parts.includes('shift')) mods.push('Shift');
  const name =
    CM_KEY_NAMES[key] ||
    (key.length === 1 ? key : key.charAt(0).toUpperCase() + key.slice(1));
  return [...mods, name].join('-');
}

/** Home: first non-whitespace column, then column 0. */
const smartHome = ({ state, dispatch }) => {
  const selection = EditorSelection.create(
    state.selection.ranges.map((range) => {
      const line = state.doc.lineAt(range.head);
      const firstNonSpace = line.from + (/^[ \t]*/.exec(line.text) || [''])[0].length;
      return EditorSelection.cursor(range.head === firstNonSpace ? line.from : firstNonSpace);
    }),
    state.selection.mainIndex
  );
  dispatch(state.update({ selection, scrollIntoView: true, userEvent: 'select' }));
  return true;
};

/**
 * Tab: indent the selection, or insert one indent unit at the caret aligned to
 * the next tab stop. CodeMirror's own insertTab always inserts a literal tab,
 * which would ignore the "insert spaces" setting.
 */
const insertIndent = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore({ state, dispatch });

  const unit = state.facet(indentUnit);
  dispatch(
    state.update(
      state.changeByRange((range) => {
        let insert = '\t';
        if (unit[0] !== '\t') {
          const line = state.doc.lineAt(range.from);
          const col = countColumn(line.text.slice(0, range.from - line.from), state.tabSize);
          insert = ' '.repeat(unit.length - (col % unit.length));
        }
        return {
          changes: { from: range.from, insert },
          range: EditorSelection.cursor(range.from + insert.length),
        };
      }),
      { scrollIntoView: true, userEvent: 'input.indent' }
    )
  );
  return true;
};

/** Alt+Enter: insert a Mermaid line-break tag at the caret. */
export const insertBr = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  dispatch(state.update(state.replaceSelection('<br>'), { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

const CM_COMMANDS = {
  duplicateLine: copyLineDown,
  indent: insertIndent,
  outdent: indentLess,
  moveLineUp,
  moveLineDown,
  newLineBelow: insertBlankLine,
  commentLine: lineComment,
  uncommentLine: lineUncomment,
  toggleComment: toggleLineComment,
  deleteLine,
  selectLine,
  copyLineUp,
  copyLineDown,
  smartHome,
  deleteWordLeft: deleteGroupBackward,
};

/** The user's bindings as CodeMirror KeyBindings, in keymap declaration order. */
export function buildKeymap(keymapSettings) {
  const bindings = [];
  for (const [name, combo] of Object.entries(keymapSettings)) {
    const command = CM_COMMANDS[name];
    if (!combo || !command) continue;
    bindings.push({ key: comboToKey(combo), run: command, preventDefault: true });
  }
  bindings.push({ key: 'Alt-Enter', run: insertBr, preventDefault: true });
  return bindings;
}
