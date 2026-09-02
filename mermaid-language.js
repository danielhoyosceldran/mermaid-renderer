// Mermaid language support for CodeMirror 6.
//
// A hand-written stream tokenizer (no lezer grammar) is enough for Mermaid:
// highlighting is line-local, since comments run to end of line and nothing
// else nests. Tags are project-local so style.css keeps owning the colours.

import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Tag } from '@lezer/highlight';
import { Decoration, MatchDecorator, ViewPlugin } from '@codemirror/view';

const KEYWORDS = new Set([
  'flowchart-elk', 'flowchart', 'graph', 'sequenceDiagram', 'classDiagram-v2',
  'classDiagram', 'stateDiagram-v2', 'stateDiagram', 'erDiagram', 'journey',
  'gantt', 'pie', 'quadrantChart', 'requirementDiagram', 'gitGraph', 'mindmap',
  'timeline', 'sankey-beta', 'xychart-beta', 'block-beta', 'packet-beta',
  'architecture-beta', 'radar-beta', 'treemap-beta', 'kanban', 'C4Context',
  'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment',
  'subgraph', 'end', 'participant', 'actor', 'class', 'state', 'note',
  'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect', 'activate', 'deactivate',
  'title', 'section', 'dateFormat', 'axisFormat', 'excludes', 'todayMarker',
  'direction', 'click', 'style', 'linkStyle', 'classDef', 'accTitle',
  'accDescr', 'left', 'right', 'of', 'over', 'to', 'as', 'TD',
  'TB', 'BT', 'RL', 'LR',
]);

// Longest alternatives first so "-->" never matches as "--".
const ARROW = /^(?:<{1,2}-{1,3}>?|-{1,3}>{1,2}|={1,3}>{1,2}|-\.{1,2}->?|\.{1,2}->?|--x|--o|\|\|--|--\|\||o--o|x--x)/;
const BR = /^<br\s*\/?>/i;
const IDENT = /^[A-Za-z_][A-Za-z0-9_-]*/;
const NUMBER = /^\d+(?:\.\d+)?/;
const STRING = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/;
const BRACKET = /^[[\](){}]/;

export const mermaidTags = {
  keyword: Tag.define(),
  arrow: Tag.define(),
  string: Tag.define(),
  number: Tag.define(),
  bracket: Tag.define(),
  comment: Tag.define(),
  lineBreak: Tag.define(),
};

export const mermaidLanguage = StreamLanguage.define({
  name: 'mermaid',
  token(stream) {
    // A comment swallows the rest of the line, directives included.
    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'mermaidComment';
    }
    if (stream.match(STRING)) return 'mermaidString';
    if (stream.match(BR)) return 'mermaidLineBreak';
    if (stream.match(ARROW)) return 'mermaidArrow';
    if (stream.match(IDENT)) {
      // Whole-identifier lookup, so "graph" in "graph-node" stays plain.
      return KEYWORDS.has(stream.current()) ? 'mermaidKeyword' : null;
    }
    if (stream.match(NUMBER)) return 'mermaidNumber';
    if (stream.match(BRACKET)) return 'mermaidBracket';
    stream.next();
    return null;
  },
  tokenTable: {
    mermaidKeyword: mermaidTags.keyword,
    mermaidArrow: mermaidTags.arrow,
    mermaidString: mermaidTags.string,
    mermaidNumber: mermaidTags.number,
    mermaidBracket: mermaidTags.bracket,
    mermaidComment: mermaidTags.comment,
    mermaidLineBreak: mermaidTags.lineBreak,
  },
});

// Classes, not colours: style.css stays the single source of theme truth.
const mermaidHighlightStyle = HighlightStyle.define([
  { tag: mermaidTags.keyword, class: 'tok-keyword' },
  { tag: mermaidTags.arrow, class: 'tok-arrow' },
  { tag: mermaidTags.string, class: 'tok-string' },
  { tag: mermaidTags.number, class: 'tok-number' },
  { tag: mermaidTags.bracket, class: 'tok-bracket' },
  { tag: mermaidTags.comment, class: 'tok-comment' },
  { tag: mermaidTags.lineBreak, class: 'tok-br' },
]);

export function mermaid() {
  return [mermaidLanguage, syntaxHighlighting(mermaidHighlightStyle)];
}

// --- <br> visual line break -------------------------------------------------

// The break is a CSS ::after on the tag itself rather than a widget: a widget
// would add a document position that vertical cursor motion steps over,
// skipping one visual row. With pure generated content every visual row still
// maps back to real text, so caret motion, selection and the line-number
// gutter all stay correct.
const breakDecorator = new MatchDecorator({
  regexp: /<br\s*\/?>/gi,
  decorate(add, from, to) {
    add(from, to, Decoration.mark({ class: 'tok-br-wrapped cm-br-break' }));
  },
});

export const brWrapPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = breakDecorator.createDeco(view);
    }

    update(update) {
      this.decorations = breakDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);
