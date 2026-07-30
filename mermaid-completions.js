// Mermaid language knowledge for the autocomplete popup: which diagram type a
// document is, which keywords/arrows that type accepts, and which identifiers
// the user has already declared.
//
// A completion item is { label, insert, detail, kind }.
//   label  - text shown in the popup and used for filtering
//   insert - text written into the editor; `$0` marks the final caret position,
//            and lines after the first are re-indented to the current line
//   detail - right-hand hint in the popup
//   kind   - 'keyword' | 'arrow' | 'symbol' | 'header'

/** Header keyword -> canonical diagram type used by the tables below. */
const HEADERS = [
  ['sequenceDiagram', 'sequence'],
  ['flowchart-elk', 'flowchart'],
  ['flowchart', 'flowchart'],
  ['graph', 'flowchart'],
  ['classDiagram-v2', 'class'],
  ['classDiagram', 'class'],
  ['stateDiagram-v2', 'state'],
  ['stateDiagram', 'state'],
  ['erDiagram', 'er'],
  ['journey', 'journey'],
  ['gantt', 'gantt'],
  ['pie', 'pie'],
  ['quadrantChart', 'quadrant'],
  ['requirementDiagram', 'requirement'],
  ['gitGraph', 'git'],
  ['mindmap', 'mindmap'],
  ['timeline', 'timeline'],
  ['sankey-beta', 'sankey'],
  ['xychart-beta', 'xychart'],
  ['block-beta', 'block'],
  ['packet-beta', 'packet'],
  ['architecture-beta', 'architecture'],
  ['radar-beta', 'radar'],
  ['treemap-beta', 'treemap'],
  ['kanban', 'kanban'],
  ['C4Context', 'c4'],
  ['C4Container', 'c4'],
  ['C4Component', 'c4'],
  ['C4Dynamic', 'c4'],
  ['C4Deployment', 'c4'],
];

/** Completions offered when no diagram header exists yet. */
const DIAGRAM_HEADERS = [
  { label: 'flowchart TD', insert: 'flowchart TD\n    $0', detail: 'top-down flowchart' },
  { label: 'flowchart LR', insert: 'flowchart LR\n    $0', detail: 'left-right flowchart' },
  { label: 'graph TD', insert: 'graph TD\n    $0', detail: 'flowchart (legacy keyword)' },
  {
    label: 'sequenceDiagram',
    insert: 'sequenceDiagram\n    participant $0',
    detail: 'sequence diagram',
  },
  { label: 'classDiagram', insert: 'classDiagram\n    $0', detail: 'class diagram' },
  { label: 'stateDiagram-v2', insert: 'stateDiagram-v2\n    $0', detail: 'state diagram' },
  { label: 'erDiagram', insert: 'erDiagram\n    $0', detail: 'entity relationship' },
  { label: 'journey', insert: 'journey\n    title $0', detail: 'user journey' },
  { label: 'gantt', insert: 'gantt\n    title $0', detail: 'gantt chart' },
  { label: 'pie', insert: 'pie title $0', detail: 'pie chart' },
  { label: 'quadrantChart', insert: 'quadrantChart\n    title $0', detail: 'quadrant chart' },
  { label: 'requirementDiagram', insert: 'requirementDiagram\n    $0', detail: 'requirements' },
  { label: 'gitGraph', insert: 'gitGraph\n    commit$0', detail: 'git graph' },
  { label: 'mindmap', insert: 'mindmap\n  root(($0))', detail: 'mindmap' },
  { label: 'timeline', insert: 'timeline\n    title $0', detail: 'timeline' },
  { label: 'sankey-beta', insert: 'sankey-beta\n$0', detail: 'sankey diagram' },
  { label: 'xychart-beta', insert: 'xychart-beta\n    title "$0"', detail: 'xy chart' },
  { label: 'block-beta', insert: 'block-beta\n    $0', detail: 'block diagram' },
  { label: 'packet-beta', insert: 'packet-beta\n    $0', detail: 'packet diagram' },
  { label: 'architecture-beta', insert: 'architecture-beta\n    $0', detail: 'architecture' },
  { label: 'kanban', insert: 'kanban\n    $0', detail: 'kanban board' },
  { label: 'C4Context', insert: 'C4Context\n    title $0', detail: 'C4 context diagram' },
  { label: '---', insert: '---\ntitle: $0\n---\n', detail: 'frontmatter block' },
];

/** Directives valid in any diagram. */
const COMMON = [
  { label: '%%{init}%%', insert: "%%{init: {'theme': '$0'}}%%", detail: 'inline config' },
  { label: 'accTitle', insert: 'accTitle: $0', detail: 'accessible title' },
  { label: 'accDescr', insert: 'accDescr: $0', detail: 'accessible description' },
  { label: 'title', insert: 'title $0', detail: 'diagram title' },
];

const KEYWORDS = {
  flowchart: [
    { label: 'subgraph', insert: 'subgraph $0\n    end', detail: 'grouped nodes' },
    { label: 'end', insert: 'end', detail: 'close subgraph' },
    { label: 'direction TB', insert: 'direction TB', detail: 'subgraph direction' },
    { label: 'direction LR', insert: 'direction LR', detail: 'subgraph direction' },
    { label: 'direction RL', insert: 'direction RL', detail: 'subgraph direction' },
    { label: 'direction BT', insert: 'direction BT', detail: 'subgraph direction' },
    { label: 'classDef', insert: 'classDef $0 fill:#f9f,stroke:#333', detail: 'define a style class' },
    { label: 'class', insert: 'class $0 className', detail: 'apply style class to nodes' },
    { label: 'style', insert: 'style $0 fill:#f9f', detail: 'inline node style' },
    { label: 'linkStyle', insert: 'linkStyle $0 stroke:#333', detail: 'style an edge by index' },
    { label: 'click', insert: 'click $0 href "https://" _blank', detail: 'node hyperlink' },
    { label: 'node[rect]', insert: '$0[Label]', detail: 'rectangle node' },
    { label: 'node(round)', insert: '$0(Label)', detail: 'rounded node' },
    { label: 'node([stadium])', insert: '$0([Label])', detail: 'stadium node' },
    { label: 'node[[subroutine]]', insert: '$0[[Label]]', detail: 'subroutine node' },
    { label: 'node[(database)]', insert: '$0[(Label)]', detail: 'cylinder node' },
    { label: 'node((circle))', insert: '$0((Label))', detail: 'circle node' },
    { label: 'node>asymmetric]', insert: '$0>Label]', detail: 'asymmetric node' },
    { label: 'node{rhombus}', insert: '$0{Label}', detail: 'decision node' },
    { label: 'node{{hexagon}}', insert: '$0{{Label}}', detail: 'hexagon node' },
    { label: 'node[/parallelogram/]', insert: '$0[/Label/]', detail: 'parallelogram node' },
    { label: 'node[/trapezoid\\]', insert: '$0[/Label\\]', detail: 'trapezoid node' },
    { label: 'node@{shape}', insert: '$0@{ shape: rect, label: "Label" }', detail: 'typed shape (v11)' },
  ],
  sequence: [
    { label: 'participant', insert: 'participant $0', detail: 'declare a participant' },
    { label: 'participant as', insert: 'participant $0 as Alias', detail: 'participant with alias' },
    { label: 'actor', insert: 'actor $0', detail: 'participant drawn as a stick figure' },
    { label: 'create participant', insert: 'create participant $0', detail: 'create mid-diagram' },
    { label: 'destroy', insert: 'destroy $0', detail: 'destroy a participant' },
    { label: 'box', insert: 'box $0\n    end', detail: 'group participants' },
    { label: 'end', insert: 'end', detail: 'close block' },
    { label: 'activate', insert: 'activate $0', detail: 'start activation bar' },
    { label: 'deactivate', insert: 'deactivate $0', detail: 'end activation bar' },
    { label: 'autonumber', insert: 'autonumber', detail: 'number the messages' },
    { label: 'loop', insert: 'loop $0\n    \nend', detail: 'loop block' },
    { label: 'alt', insert: 'alt $0\n    \nelse \n    \nend', detail: 'alternative paths' },
    { label: 'else', insert: 'else $0', detail: 'alt branch' },
    { label: 'opt', insert: 'opt $0\n    \nend', detail: 'optional block' },
    { label: 'par', insert: 'par $0\n    \nand \n    \nend', detail: 'parallel block' },
    { label: 'and', insert: 'and $0', detail: 'par branch' },
    { label: 'critical', insert: 'critical $0\n    \noption \n    \nend', detail: 'critical region' },
    { label: 'option', insert: 'option $0', detail: 'critical branch' },
    { label: 'break', insert: 'break $0\n    \nend', detail: 'break block' },
    { label: 'rect', insert: 'rect rgb(200, 220, 240)\n    $0\nend', detail: 'background rectangle' },
    { label: 'Note right of', insert: 'Note right of $0: ', detail: 'note beside a participant' },
    { label: 'Note left of', insert: 'Note left of $0: ', detail: 'note beside a participant' },
    { label: 'Note over', insert: 'Note over $0: ', detail: 'note spanning participants' },
    { label: 'links', insert: 'links $0: {"Dashboard": "https://"}', detail: 'participant menu links' },
  ],
  class: [
    { label: 'class', insert: 'class $0 {\n    \n}', detail: 'class with members' },
    { label: 'namespace', insert: 'namespace $0 {\n    \n}', detail: 'group classes' },
    { label: '<<interface>>', insert: '<<interface>>', detail: 'annotation' },
    { label: '<<abstract>>', insert: '<<abstract>>', detail: 'annotation' },
    { label: '<<service>>', insert: '<<service>>', detail: 'annotation' },
    { label: '<<enumeration>>', insert: '<<enumeration>>', detail: 'annotation' },
    { label: 'classDef', insert: 'classDef $0 fill:#f9f', detail: 'define a style class' },
    { label: 'cssClass', insert: 'cssClass "$0" className', detail: 'apply a css class' },
    { label: 'style', insert: 'style $0 fill:#f9f', detail: 'inline style' },
    { label: 'note for', insert: 'note for $0 "text"', detail: 'note attached to a class' },
    { label: 'note', insert: 'note "$0"', detail: 'free-floating note' },
    { label: 'link', insert: 'link $0 "https://" "tooltip"', detail: 'class hyperlink' },
    { label: 'callback', insert: 'callback $0 "fnName"', detail: 'class click callback' },
    { label: 'direction LR', insert: 'direction LR', detail: 'layout direction' },
  ],
  state: [
    { label: 'state', insert: 'state "$0" as id', detail: 'state with a description' },
    { label: 'state composite', insert: 'state $0 {\n    \n}', detail: 'nested states' },
    { label: '[*]', insert: '[*]', detail: 'start / end pseudo-state' },
    { label: '<<choice>>', insert: 'state $0 <<choice>>', detail: 'choice node' },
    { label: '<<fork>>', insert: 'state $0 <<fork>>', detail: 'fork node' },
    { label: '<<join>>', insert: 'state $0 <<join>>', detail: 'join node' },
    { label: 'note right of', insert: 'note right of $0\n    \nend note', detail: 'note' },
    { label: 'note left of', insert: 'note left of $0\n    \nend note', detail: 'note' },
    { label: 'direction LR', insert: 'direction LR', detail: 'layout direction' },
    { label: 'classDef', insert: 'classDef $0 fill:#f9f', detail: 'define a style class' },
    { label: 'class', insert: 'class $0 className', detail: 'apply style class' },
    { label: 'concurrent --', insert: '--', detail: 'concurrency separator' },
  ],
  er: [
    { label: 'PK', insert: 'PK', detail: 'primary key' },
    { label: 'FK', insert: 'FK', detail: 'foreign key' },
    { label: 'UK', insert: 'UK', detail: 'unique key' },
    { label: 'entity', insert: '$0 {\n    string name\n}', detail: 'entity with attributes' },
    { label: 'direction LR', insert: 'direction LR', detail: 'layout direction' },
  ],
  journey: [
    { label: 'section', insert: 'section $0', detail: 'journey section' },
    { label: 'task', insert: '$0: 5: Me', detail: 'task: score: actors' },
  ],
  gantt: [
    { label: 'dateFormat', insert: 'dateFormat YYYY-MM-DD', detail: 'input date format' },
    { label: 'axisFormat', insert: 'axisFormat %Y-%m-%d', detail: 'axis label format' },
    { label: 'tickInterval', insert: 'tickInterval 1week', detail: 'axis tick spacing' },
    { label: 'excludes', insert: 'excludes weekends', detail: 'skip dates' },
    { label: 'includes', insert: 'includes $0', detail: 'force-include dates' },
    { label: 'todayMarker', insert: 'todayMarker off', detail: 'today line' },
    { label: 'weekday', insert: 'weekday monday', detail: 'first day of week' },
    { label: 'section', insert: 'section $0', detail: 'gantt section' },
    { label: 'task', insert: '$0 :a1, 2024-01-01, 30d', detail: 'task with id and duration' },
    { label: 'milestone', insert: '$0 : milestone, m1, 2024-01-01, 0d', detail: 'milestone' },
    { label: 'active', insert: 'active, ', detail: 'task state' },
    { label: 'done', insert: 'done, ', detail: 'task state' },
    { label: 'crit', insert: 'crit, ', detail: 'task state' },
    { label: 'after', insert: 'after $0', detail: 'relative start' },
  ],
  pie: [
    { label: 'showData', insert: 'showData', detail: 'print values next to labels' },
    { label: 'slice', insert: '"$0" : 42', detail: 'label : value' },
  ],
  quadrant: [
    { label: 'x-axis', insert: 'x-axis $0 --> High', detail: 'x axis labels' },
    { label: 'y-axis', insert: 'y-axis $0 --> High', detail: 'y axis labels' },
    { label: 'quadrant-1', insert: 'quadrant-1 $0', detail: 'top-right label' },
    { label: 'quadrant-2', insert: 'quadrant-2 $0', detail: 'top-left label' },
    { label: 'quadrant-3', insert: 'quadrant-3 $0', detail: 'bottom-left label' },
    { label: 'quadrant-4', insert: 'quadrant-4 $0', detail: 'bottom-right label' },
    { label: 'point', insert: '$0: [0.5, 0.5]', detail: 'plot a point' },
  ],
  requirement: [
    { label: 'requirement', insert: 'requirement $0 {\n    id: 1\n    text: \n    risk: medium\n    verifymethod: test\n}', detail: 'requirement block' },
    { label: 'functionalRequirement', insert: 'functionalRequirement $0 {\n    id: 1\n    text: \n}', detail: 'requirement type' },
    { label: 'performanceRequirement', insert: 'performanceRequirement $0 {\n    id: 1\n    text: \n}', detail: 'requirement type' },
    { label: 'interfaceRequirement', insert: 'interfaceRequirement $0 {\n    id: 1\n    text: \n}', detail: 'requirement type' },
    { label: 'physicalRequirement', insert: 'physicalRequirement $0 {\n    id: 1\n    text: \n}', detail: 'requirement type' },
    { label: 'designConstraint', insert: 'designConstraint $0 {\n    id: 1\n    text: \n}', detail: 'requirement type' },
    { label: 'element', insert: 'element $0 {\n    type: simulation\n}', detail: 'element block' },
  ],
  git: [
    { label: 'commit', insert: 'commit id: "$0"', detail: 'a commit' },
    { label: 'commit tag', insert: 'commit id: "$0" tag: "v1.0"', detail: 'tagged commit' },
    { label: 'commit type', insert: 'commit type: HIGHLIGHT', detail: 'NORMAL | REVERSE | HIGHLIGHT' },
    { label: 'branch', insert: 'branch $0', detail: 'create a branch' },
    { label: 'checkout', insert: 'checkout $0', detail: 'switch branch' },
    { label: 'merge', insert: 'merge $0', detail: 'merge a branch' },
    { label: 'cherry-pick', insert: 'cherry-pick id: "$0"', detail: 'cherry-pick a commit' },
  ],
  mindmap: [
    { label: 'root', insert: 'root(($0))', detail: 'mindmap root' },
    { label: 'node[square]', insert: '$0[Label]', detail: 'square node' },
    { label: 'node(round)', insert: '$0(Label)', detail: 'rounded node' },
    { label: 'node((circle))', insert: '$0((Label))', detail: 'circle node' },
    { label: 'node))bang((', insert: '$0))Label((', detail: 'bang node' },
    { label: 'node{{cloud}}', insert: '$0{{Label}}', detail: 'cloud node' },
    { label: '::icon', insert: '::icon(fa fa-$0)', detail: 'node icon' },
  ],
  timeline: [
    { label: 'section', insert: 'section $0', detail: 'timeline section' },
    { label: 'period', insert: '$0 : event', detail: 'period : event' },
  ],
  sankey: [{ label: 'link', insert: '$0,Target,10', detail: 'source,target,value' }],
  xychart: [
    { label: 'x-axis', insert: 'x-axis [$0]', detail: 'category or range axis' },
    { label: 'y-axis', insert: 'y-axis "$0" 0 --> 100', detail: 'value axis' },
    { label: 'line', insert: 'line [$0]', detail: 'line series' },
    { label: 'bar', insert: 'bar [$0]', detail: 'bar series' },
  ],
  block: [
    { label: 'columns', insert: 'columns $0', detail: 'grid width' },
    { label: 'block', insert: 'block:$0\n    \nend', detail: 'nested block' },
    { label: 'space', insert: 'space', detail: 'empty cell' },
    { label: 'style', insert: 'style $0 fill:#f9f', detail: 'inline style' },
  ],
  packet: [{ label: 'field', insert: '0-15: "$0"', detail: 'bit range: label' }],
  architecture: [
    { label: 'group', insert: 'group $0(cloud)[Label]', detail: 'group of services' },
    { label: 'service', insert: 'service $0(server)[Label]', detail: 'a service' },
    { label: 'junction', insert: 'junction $0', detail: 'edge junction' },
    { label: 'in', insert: 'in $0', detail: 'place inside a group' },
  ],
  radar: [
    { label: 'axis', insert: 'axis $0', detail: 'radar axis' },
    { label: 'curve', insert: 'curve $0{1, 2, 3}', detail: 'data curve' },
    { label: 'showLegend', insert: 'showLegend true', detail: 'legend toggle' },
    { label: 'max', insert: 'max 100', detail: 'axis maximum' },
  ],
  treemap: [{ label: 'node', insert: '"$0"\n    "Child": 10', detail: 'treemap node' }],
  kanban: [
    { label: 'column', insert: '$0[Column title]', detail: 'kanban column' },
    { label: 'task', insert: '$0[Task]@{ assigned: "me", priority: "High" }', detail: 'task with metadata' },
  ],
  c4: [
    { label: 'Person', insert: 'Person($0, "Label", "Description")', detail: 'C4 person' },
    { label: 'Person_Ext', insert: 'Person_Ext($0, "Label", "Description")', detail: 'external person' },
    { label: 'System', insert: 'System($0, "Label", "Description")', detail: 'C4 system' },
    { label: 'System_Ext', insert: 'System_Ext($0, "Label", "Description")', detail: 'external system' },
    { label: 'Container', insert: 'Container($0, "Label", "Tech", "Description")', detail: 'C4 container' },
    { label: 'Component', insert: 'Component($0, "Label", "Tech", "Description")', detail: 'C4 component' },
    { label: 'Boundary', insert: 'Boundary($0, "Label") {\n    \n}', detail: 'generic boundary' },
    { label: 'System_Boundary', insert: 'System_Boundary($0, "Label") {\n    \n}', detail: 'system boundary' },
    { label: 'Enterprise_Boundary', insert: 'Enterprise_Boundary($0, "Label") {\n    \n}', detail: 'enterprise boundary' },
    { label: 'Rel', insert: 'Rel($0, to, "Label")', detail: 'relationship' },
    { label: 'UpdateLayoutConfig', insert: 'UpdateLayoutConfig($c4ShapeInRow="3")', detail: 'layout config' },
  ],
};

/** Link/arrow syntax, offered when the caret sits on arrow-ish characters. */
const ARROWS = {
  flowchart: [
    ['-->', 'arrow'],
    ['---', 'open link'],
    ['-->|text|', 'arrow with label'],
    ['-- text -->', 'arrow with label'],
    ['-.->', 'dotted arrow'],
    ['-.-', 'dotted link'],
    ['==>', 'thick arrow'],
    ['===', 'thick link'],
    ['--o', 'circle end'],
    ['--x', 'cross end'],
    ['<-->', 'bidirectional'],
    ['~~~', 'invisible link'],
  ],
  sequence: [
    ['->>', 'solid arrow'],
    ['-->>', 'dotted arrow'],
    ['->', 'solid line, no arrowhead'],
    ['-->', 'dotted line, no arrowhead'],
    ['-x', 'solid line with a cross'],
    ['--x', 'dotted line with a cross'],
    ['-)', 'solid async arrow'],
    ['--)', 'dotted async arrow'],
    ['<<->>', 'bidirectional solid'],
    ['<<-->>', 'bidirectional dotted'],
  ],
  class: [
    ['<|--', 'inheritance'],
    ['*--', 'composition'],
    ['o--', 'aggregation'],
    ['-->', 'association'],
    ['--', 'link'],
    ['..>', 'dependency'],
    ['..|>', 'realization'],
    ['..', 'dotted link'],
  ],
  state: [['-->', 'transition']],
  er: [
    ['||--||', 'one to one'],
    ['||--o{', 'one to zero or many'],
    ['||--|{', 'one to one or many'],
    ['}o--o{', 'zero-or-many to zero-or-many'],
    ['}|..|{', 'non-identifying relationship'],
    ['|o--o|', 'zero or one to zero or one'],
  ],
  requirement: [
    ['- satisfies ->', 'satisfies'],
    ['- traces ->', 'traces'],
    ['- contains ->', 'contains'],
    ['- copies ->', 'copies'],
    ['- derives ->', 'derives'],
    ['- verifies ->', 'verifies'],
    ['- refines ->', 'refines'],
  ],
  architecture: [
    ['--', 'connection'],
    ['-->', 'directed connection'],
    ['L--R', 'left-to-right ports'],
    ['T--B', 'top-to-bottom ports'],
  ],
  block: [['-->', 'arrow'], ['---', 'link']],
  mindmap: [],
  journey: [],
  gantt: [],
  pie: [],
  quadrant: [],
  git: [],
  timeline: [],
  sankey: [],
  xychart: [],
  packet: [],
  radar: [],
  treemap: [],
  kanban: [],
  c4: [],
};

/** Words that are syntax, not user identifiers - excluded from symbol scraping. */
const RESERVED = new Set(
  [
    'graph', 'flowchart', 'subgraph', 'end', 'direction', 'classDef', 'class', 'style',
    'linkStyle', 'click', 'href', 'call', 'TB', 'TD', 'BT', 'RL', 'LR', 'of', 'as', 'in',
    'sequenceDiagram', 'participant', 'actor', 'activate', 'deactivate', 'autonumber',
    'loop', 'alt', 'else', 'opt', 'par', 'and', 'critical', 'option', 'break', 'rect',
    'note', 'Note', 'over', 'left', 'right', 'box', 'create', 'destroy', 'links', 'link',
    'classDiagram', 'namespace', 'cssClass', 'callback', 'stateDiagram', 'state',
    'erDiagram', 'journey', 'section', 'gantt', 'dateFormat', 'axisFormat', 'excludes',
    'includes', 'todayMarker', 'tickInterval', 'weekday', 'active', 'done', 'crit',
    'milestone', 'after', 'pie', 'showData', 'title', 'quadrantChart', 'requirementDiagram',
    'requirement', 'element', 'gitGraph', 'commit', 'branch', 'checkout', 'merge',
    'cherry-pick', 'id', 'tag', 'type', 'mindmap', 'root', 'timeline', 'accTitle',
    'accDescr', 'columns', 'space', 'block', 'axis', 'curve', 'max', 'showLegend',
    'group', 'service', 'junction', 'text', 'risk', 'verifymethod', 'true', 'false',
  ]
);

/**
 * Diagram type of `text`, skipping frontmatter, comments and init directives.
 * Returns null when no header has been typed yet.
 */
export function detectDiagramType(text) {
  const lines = text.split('\n');
  let i = 0;

  // YAML frontmatter
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++;
  }

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%%')) continue;
    for (const [keyword, type] of HEADERS) {
      if (line === keyword || line.startsWith(keyword + ' ') || line.startsWith(keyword + ':')) {
        return type;
      }
    }
    // First meaningful line is not a header: unknown dialect.
    return null;
  }
  return null;
}

/**
 * Identifiers the user already declared. Labels, strings and comments are
 * stripped first so only bare identifiers survive.
 */
export function collectSymbols(text, type) {
  const stripped = text
    .split('\n')
    .map((l) => (l.trim().startsWith('%%') ? '' : l.replace(/%%.*$/, '')))
    .join('\n')
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/\[[^\]\n]*\]/g, ' ')
    .replace(/\{[^}\n]*\}/g, ' ')
    .replace(/\([^)\n]*\)/g, ' ')
    .replace(/<<[^>\n]*>>/g, ' ');

  const found = new Map();
  const add = (rawName, detail) => {
    // An id butted against an arrow ("Alice->>Bob") keeps a trailing dash.
    const name = rawName ? rawName.replace(/-+$/, '') : rawName;
    if (!name || RESERVED.has(name) || /^\d/.test(name)) return;
    if (!found.has(name)) found.set(name, detail);
  };

  // Explicit declarations win, so they get the better `detail` text.
  const declarations = [
    [/^\s*(?:participant|actor)\s+([A-Za-z_][\w-]*)(?:\s+as\s+(.+))?/gm, 'participant'],
    [/^\s*(?:create\s+)?(?:participant|actor)\s+([A-Za-z_][\w-]*)/gm, 'participant'],
    [/^\s*class\s+([A-Za-z_][\w-]*)/gm, 'class'],
    [/^\s*state\s+([A-Za-z_][\w-]*)/gm, 'state'],
    [/\s+as\s+([A-Za-z_][\w-]*)/gm, 'alias'],
    [/^\s*subgraph\s+([A-Za-z_][\w-]*)/gm, 'subgraph'],
    [/^\s*branch\s+([A-Za-z_][\w-]*)/gm, 'branch'],
    [/^\s*(?:requirement|element|\w+Requirement|designConstraint)\s+([A-Za-z_][\w-]*)/gm, 'requirement'],
    [/^\s*(?:service|group|junction)\s+([A-Za-z_][\w-]*)/gm, 'service'],
  ];
  for (const [re, detail] of declarations) {
    for (const m of stripped.matchAll(re)) add(m[1], detail);
  }

  // Anything left that looks like a bare identifier is probably a node id.
  for (const m of stripped.matchAll(/[A-Za-z_][\w-]*/g)) add(m[0], type ? 'id' : 'word');

  return [...found].map(([label, detail]) => ({
    label,
    insert: label,
    detail,
    kind: 'symbol',
  }));
}

/** Everything that could be inserted at the caret, before prefix filtering. */
export function completionsFor(text, type, prefixKind) {
  if (!type) {
    return DIAGRAM_HEADERS.map((c) => ({ ...c, kind: 'header' }));
  }

  if (prefixKind === 'arrow') {
    return (ARROWS[type] || []).map(([label, detail]) => ({
      label,
      insert: label,
      detail,
      kind: 'arrow',
    }));
  }

  const keywords = (KEYWORDS[type] || []).map((c) => ({ ...c, kind: 'keyword' }));
  const common = COMMON.map((c) => ({ ...c, kind: 'keyword' }));
  return [...keywords, ...collectSymbols(text, type), ...common];
}

export { ARROWS, KEYWORDS, DIAGRAM_HEADERS };
