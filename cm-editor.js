// CodeMirror 6 editor for the left panel.
//
// Everything the settings panel can change lives in a Compartment, and
// applySettings() reconfigures all of them at once, so the view can never
// disagree with the settings object.

import { Compartment, EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  rectangularSelection,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewline,
  insertNewlineKeepIndent,
} from '@codemirror/commands';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

import { mermaid, mermaidLanguage, brWrapPlugin } from './mermaid-language.js';
import { mermaidCompletionSource } from './mermaid-completion.js';
import { buildKeymap } from './editor.js';

const wrapComp = new Compartment();
const indentComp = new Compartment();
const keymapComp = new Compartment();
const brWrapComp = new Compartment();
const commentComp = new Compartment();

function indentExtensions(settings) {
  const size = Math.max(1, Math.min(8, Math.floor(settings.tabSize) || 1));
  return [
    EditorState.tabSize.of(size),
    indentUnit.of(settings.insertSpaces ? ' '.repeat(size) : '\t'),
  ];
}

function commentExtension(settings) {
  // An empty token would make the comment commands strip leading whitespace
  // instead of commenting, so fall back to Mermaid's own token.
  const line = settings.commentToken.trim() || '%%';
  return mermaidLanguage.data.of({ commentTokens: { line } });
}

export function createEditor({ parent, doc, getSettings, onChange, placeholder }) {
  const settings = getSettings();

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        bracketMatching(),
        closeBrackets(),
        placeholderExt(placeholder || ''),
        mermaid(),
        commentComp.of(commentExtension(settings)),
        indentComp.of(indentExtensions(settings)),
        wrapComp.of(settings.wordWrap ? EditorView.lineWrapping : []),
        brWrapComp.of(settings.brWrap ? brWrapPlugin : []),

        // Tab accepts the highlighted completion, and falls through to the
        // user's Tab binding when the popup is closed.
        Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),

        autocompletion({
          override: [mermaidCompletionSource(getSettings)],
          defaultKeymap: true,
          icons: false,
        }),

        // Declared after autocompletion so its Enter binding wins while the
        // popup is open.
        keymapComp.of(keymap.of(buildKeymap(settings.keymap))),
        keymap.of([
          {
            key: 'Enter',
            run: (target) =>
              getSettings().autoIndent ? insertNewlineKeepIndent(target) : insertNewline(target),
          },
        ]),
        keymap.of(closeBracketsKeymap),
        keymap.of(searchKeymap),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),

        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) onChange();
        }),
      ],
    }),
  });

  function applySettings() {
    const s = getSettings();
    view.dispatch({
      effects: [
        commentComp.reconfigure(commentExtension(s)),
        indentComp.reconfigure(indentExtensions(s)),
        wrapComp.reconfigure(s.wordWrap ? EditorView.lineWrapping : []),
        brWrapComp.reconfigure(s.brWrap ? brWrapPlugin : []),
        keymapComp.reconfigure(keymap.of(buildKeymap(s.keymap))),
      ],
    });
  }

  return {
    view,

    getValue() {
      return view.state.doc.toString();
    },

    setValue(text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      });
    },

    focus() {
      view.focus();
    },

    applySettings,
  };
}
