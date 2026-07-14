import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const d = dirname(fileURLToPath(import.meta.url));
const SRC = join(d, 'src'); if (!existsSync(SRC)) mkdirSync(SRC);
let html = readFileSync(join(d, 'viewer-template.html'), 'utf8');
const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
writeFileSync(join(SRC, 'styles.css'), css.trim() + '\n');
function findScriptBlocks(src) {
  const OPEN = '<script>';
  const CLOSE = '</script>';
  const found = [];
  let at = 0;
  for (;;) {
    const start = src.indexOf(OPEN, at);
    if (start === -1) break;
    const inner = start + OPEN.length;
    const end = src.indexOf(CLOSE, inner);
    if (end === -1) break;
    found.push({ full: src.slice(start, end + CLOSE.length), inner: src.slice(inner, end) });
    at = end + CLOSE.length;
  }
  return found;
}
const scripts = findScriptBlocks(html);
const dataBlock = scripts.find(s => s.inner.includes('__WORKFLOWS_JSON__'));
const appBlocks = scripts.filter(s => s !== dataBlock).map(s => s.inner.trim());
writeFileSync(join(SRC, 'app.js'), appBlocks.join('\n\n') + '\n');
html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="styles.css">');
html = html.split(dataBlock.full).join('<script src="workflows.js"></script>');
let first = true;
for (const block of scripts) {
  if (block === dataBlock) continue;
  let replacement = '';
  if (first) { first = false; replacement = '<script src="app.js"></script>'; }
  html = html.split(block.full).join(replacement);
}
html = html.replace(/\n{3,}/g, '\n\n');
writeFileSync(join(SRC, 'index.html'), html);
console.log('css bytes:', css.length, '| app blocks:', appBlocks.length, '| total scripts:', scripts.length);
