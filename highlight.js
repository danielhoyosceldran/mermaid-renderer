// Lightweight syntax highlighter for Mermaid source, rendered as a read-only
// <pre> layer behind the transparent editor <textarea>.

const KEYWORDS = [
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
  'accDescr', 'accDescr{', 'left', 'right', 'of', 'over', 'to', 'as', 'TD',
  'TB', 'BT', 'RL', 'LR',
];
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Highlight a single line, returning HTML with <span class="tok-*"> markers. */
function highlightLine(line) {
  // Comments swallow the rest of the line: highlight and return early.
  const commentIdx = line.indexOf('%%');
  let code = commentIdx === -1 ? line : line.slice(0, commentIdx);
  const comment = commentIdx === -1 ? '' : line.slice(commentIdx);

  // Tokenize left-to-right by scanning for the earliest next match among
  // strings, arrows, keywords and numbers, escaping literal text in between.
  const matchers = [
    { re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, cls: 'tok-string' },
    { re: /(?:<{1,2}-{1,3}>?|-{1,3}>{1,2}|={1,3}>{1,2}|-\.{1,2}->?|\.{1,2}->?|--x|--o|\|\|--|--\|\||o--o|x--x)/g, cls: 'tok-arrow' },
    { re: new RegExp('\\b(?:' + KEYWORDS.map(escapeRe).join('|') + ')\\b', 'g'), cls: 'tok-keyword' },
    { re: /\b\d+(?:\.\d+)?\b/g, cls: 'tok-number' },
    { re: /[[\](){}]/g, cls: 'tok-bracket' },
  ];

  let out = '';
  let i = 0;
  while (i < code.length) {
    let best = null;
    for (const m of matchers) {
      m.re.lastIndex = i;
      const res = m.re.exec(code);
      if (res && res.index >= i && (best === null || res.index < best.index)) {
        best = { index: res.index, text: res[0], cls: m.cls };
      }
    }
    if (!best) {
      out += escapeHtml(code.slice(i));
      break;
    }
    out += escapeHtml(code.slice(i, best.index));
    out += `<span class="${best.cls}">${escapeHtml(best.text)}</span>`;
    i = best.index + best.text.length;
  }

  if (comment) out += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
  return out;
}

export function highlightToHtml(source) {
  return source.split('\n').map(highlightLine).join('\n');
}
