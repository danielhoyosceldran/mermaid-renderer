// CodeMirror completion source backed by mermaid-completions.js.
//
// CodeMirror's own fuzzy filter is switched off (`filter: false`) because the
// Mermaid prefix can be an arrow token ("-->"), which its word-based matcher
// does not understand; the project's scoring from the previous popup is kept
// verbatim instead.

import { snippetCompletion } from '@codemirror/autocomplete';
import { detectDiagramType, completionsFor } from './mermaid-completions.js';

const MAX_ITEMS = 12;
// Typing pops the list open only from this prefix length; Ctrl+Space ignores it.
const MIN_PREFIX = 2;

const WORD_BEFORE = /[A-Za-z_%<][\w<>%-]*$/;
const ARROW_BEFORE = /[-=.~|<>ox*]+$/;

// kind (from mermaid-completions.js) -> CodeMirror completion icon type
const TYPE_BY_KIND = {
  header: 'type',
  keyword: 'keyword',
  symbol: 'variable',
  arrow: 'text',
};

/** Word or arrow token immediately before the caret, within its own line. */
function prefixAt(state, pos) {
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  const word = before.match(WORD_BEFORE);
  if (word) return { text: word[0], start: pos - word[0].length, kind: 'word' };
  const arrow = before.match(ARROW_BEFORE);
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

function toOption(item) {
  const type = TYPE_BY_KIND[item.kind] || 'text';
  if (item.insert.includes('$0')) {
    // CodeMirror snippets mark the caret with ${}, and re-indent continuation
    // lines to the current line for us.
    return snippetCompletion(item.insert.replace('$0', '${}'), {
      label: item.label,
      detail: item.detail,
      type,
    });
  }
  return { label: item.label, detail: item.detail, type, apply: item.insert };
}

/**
 * Candidate lists depend only on the document, which is immutable, so they can
 * be cached against it — collectSymbols() scans the whole text several times.
 */
function makeCandidateCache() {
  let cachedDoc = null;
  let cached = null;
  return (state, prefixKind) => {
    if (cachedDoc !== state.doc) {
      cachedDoc = state.doc;
      cached = {};
    }
    if (!(prefixKind in cached)) {
      const text = state.doc.toString();
      cached[prefixKind] = completionsFor(text, detectDiagramType(text), prefixKind);
    }
    return cached[prefixKind];
  };
}

export function mermaidCompletionSource(getSettings) {
  const candidatesFor = makeCandidateCache();

  return (context) => {
    if (!context.explicit && !getSettings().suggestions) return null;

    const prefix = prefixAt(context.state, context.pos);
    if (!context.explicit && prefix.text.length < MIN_PREFIX) return null;

    const options = candidatesFor(context.state, prefix.kind)
      .map((item) => ({ item, s: score(item.label, prefix.text) }))
      .filter(({ s }) => s >= 0)
      // Sort is stable, so equal scores keep the table's declaration order.
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_ITEMS)
      .map(({ item }) => toOption(item));

    // Nothing useful to add when the only hit is what is already typed.
    if (!options.length || (options.length === 1 && options[0].label === prefix.text)) {
      return null;
    }

    return { from: prefix.start, options, filter: false };
  };
}
