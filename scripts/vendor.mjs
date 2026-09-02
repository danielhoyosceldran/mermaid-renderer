// Copies the runtime dependencies out of node_modules into vendor/, which is
// what the app actually loads. Run after `npm install`: `npm run vendor`.
//
// CodeMirror ships one ESM file per package, and those files import each other
// by bare specifier, so index.html declares an import map pointing at the flat
// copies produced here.

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = (p) => resolve(root, 'node_modules', p);
const to = (p) => resolve(root, 'vendor', p);

// [source in node_modules, destination in vendor]
const CODEMIRROR_FILES = [
  ['@codemirror/state/dist/index.js', 'state.js'],
  ['@codemirror/view/dist/index.js', 'view.js'],
  ['@codemirror/language/dist/index.js', 'language.js'],
  ['@codemirror/commands/dist/index.js', 'commands.js'],
  ['@codemirror/autocomplete/dist/index.js', 'autocomplete.js'],
  ['@codemirror/search/dist/index.js', 'search.js'],
  ['@lezer/common/dist/index.js', 'lezer-common.js'],
  ['@lezer/highlight/dist/index.js', 'lezer-highlight.js'],
  ['@marijn/find-cluster-break/src/index.js', 'find-cluster-break.js'],
  ['crelt/index.js', 'crelt.js'],
  ['style-mod/src/style-mod.js', 'style-mod.js'],
  ['w3c-keyname/index.js', 'w3c-keyname.js'],
];

await rm(to('mermaid'), { recursive: true, force: true });
await mkdir(to('mermaid'), { recursive: true });
await cp(from('mermaid/dist'), to('mermaid'), { recursive: true });
console.log('vendored mermaid');

await rm(to('codemirror'), { recursive: true, force: true });
await mkdir(to('codemirror'), { recursive: true });
for (const [src, dest] of CODEMIRROR_FILES) {
  await cp(from(src), to('codemirror/' + dest));
}
console.log(`vendored ${CODEMIRROR_FILES.length} CodeMirror files`);
