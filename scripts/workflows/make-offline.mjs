#!/usr/bin/env node
// Post-processes docs/workflows/workflow-flowcharts.html into a fully self-contained
// OFFLINE file by inlining the vendored Mermaid + svg-pan-zoom libraries and dropping
// the web-font link. Output: docs/workflows/workflow-flowcharts-offline.html
// Run:  node scripts/workflows/make-offline.mjs   (run build-workflows-html.mjs first)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const IN = join(REPO, 'docs', 'workflows', 'workflow-flowcharts.html');
const OUT = join(REPO, 'docs', 'workflows', 'workflow-flowcharts-offline.html');
const VEND = join(__dirname, 'vendor');

function lib(name) {
  // escape any literal </script> so the inline block cannot terminate early
  return readFileSync(join(VEND, name), 'utf8').split('</script>').join('<\\/script>');
}

const MER = '<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>';
const PZ = '<script src="https://cdnjs.cloudflare.com/ajax/libs/svg-pan-zoom/3.6.1/svg-pan-zoom.min.js"></script>';
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />';

let html = readFileSync(IN, 'utf8');
let hits = { mermaid: html.includes(MER), panzoom: html.includes(PZ), fonts: html.includes(FONTS) };

html = html.split(MER).join('<script>' + lib('mermaid.min.js') + '</script>');
html = html.split(PZ).join('<script>' + lib('svg-pan-zoom.min.js') + '</script>');
html = html.split(FONTS).join('<!-- web fonts omitted for offline use; system font fallback applies -->');

writeFileSync(OUT, html);

const remaining = (html.match(/https?:\/\//g) || []).length;
console.log('Wrote ' + OUT);
console.log('Inlined -> mermaid:' + hits.mermaid + ' panzoom:' + hits.panzoom + ' fonts-dropped:' + hits.fonts);
console.log('Size: ' + (html.length / 1048576).toFixed(2) + ' MB | remaining http(s) refs: ' + remaining);
