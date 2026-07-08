#!/usr/bin/env node
// build-workflows-html.mjs  (Workflow Studio build)
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const FLOWS = join(REPO, 'docs', 'workflows', 'flows');
const SRC = join(__dirname, 'src');
const OUT = join(REPO, 'docs', 'workflows', 'workflow-flowcharts.html');
const OUT_OFFLINE = join(REPO, 'docs', 'workflows', 'workflow-flowcharts-offline.html');
const STAFF = [
  { name: 'Sean Lattin', role: 'Company Director', roleShort: 'Director' },
  { name: 'Colin Hanlon', role: 'Operations Manager', roleShort: 'Ops' },
  { name: 'Beau Murphy', role: 'Project Manager', roleShort: 'PM' },
  { name: 'Marco Mantovaninni', role: 'WHS & Commercial Compliance', roleShort: 'WHS' },
  { name: 'Raj Pudasaini', role: 'Senior Estimator', roleShort: 'Estimating' },
  { name: 'Amy Russian', role: 'Accounts', roleShort: 'Accounts' },
  { name: 'Matthew Knox', role: 'Warehouse Manager', roleShort: 'Warehouse' },
];
const ROLES = [
  { role: 'Director', person: 'Sean Lattin' },
  { role: 'Operations Manager', person: 'Colin Hanlon' },
  { role: 'WHS & Commercial Compliance', person: 'Marco Mantovaninni' },
  { role: 'Estimator', person: 'Raj Pudasaini' },
  { role: 'Project Manager', person: 'Beau Murphy' },
  { role: 'Finance & Administration Officer', person: 'Amy Russian' },
  { role: 'Logistics & Warehouse Manager', person: '' },
  { role: 'Warehouse / Logistics Operator', person: '' },
  { role: 'Transport Operator / Truck Driver', person: '' },
  { role: 'CW5 - Senior Specialist / Site Manager', person: '' },
  { role: 'CW4 - Post-Trade Specialist', person: '' },
  { role: 'CW3 - Tradesperson / Skilled Operator', person: '' },
  { role: 'CW2 - Experienced Labourer / Basic Operator', person: '' },
  { role: 'CW1D - Demolition Labourer', person: '' },
];
const TYPE_BY_CLASS = { startEnd: 'startEnd', process: 'process', decision: 'decision', io: 'io', doc: 'doc', output: 'output' };
function parseToken(tokRaw) {
  let tok = tokRaw.trim(); let type = null;
  const cm = tok.match(/:::(\w+)/);
  if (cm) { type = TYPE_BY_CLASS[cm[1]] || null; tok = tok.replace(/:::\w+/, '').trim(); }
  let id = null, label = null, m;
  if ((m = tok.match(/^(\w+)\(\[(.*)\]\)$/))) { id = m[1]; label = m[2]; type = type || 'startEnd'; }
  else if ((m = tok.match(/^(\w+)\[\[(.*)\]\]$/))) { id = m[1]; label = m[2]; type = type || 'process'; }
  else if ((m = tok.match(/^(\w+)\[\/(.*)\/\]$/))) { id = m[1]; label = m[2]; type = type || 'io'; }
  else if ((m = tok.match(/^(\w+)\{(.*)\}$/))) { id = m[1]; label = m[2]; type = type || 'decision'; }
  else if ((m = tok.match(/^(\w+)\[(.*)\]$/))) { id = m[1]; label = m[2]; type = type || 'process'; }
  else if ((m = tok.match(/^(\w+)$/))) { id = m[1]; }
  if (label != null) label = label.replace(/&quot;/g, '"').replace(/<br\s*\/?>/gi, '\n');
  return { id, label, type };
}
function parseFlow(file) {
  const raw = readFileSync(join(FLOWS, file), 'utf8');
  const lines = raw.split(/\r?\n/);
  const meta = { title: file.replace(/\.mmd$/, ''), module: '', role: '', status: '', view: '' };
  const nodes = {}, order = [], edges = [];
  function touch(t) { if (!t || !t.id) return; if (!nodes[t.id]) { nodes[t.id] = { id: t.id, label: t.id, type: 'process' }; order.push(t.id); } if (t.label != null) nodes[t.id].label = t.label; if (t.type) nodes[t.id].type = t.type; }
  for (const line of lines) {
    const t = line.trim(); if (!t) continue;
    const mm = t.match(/^%%\s*title:\s*(.*)$/i);
    if (mm) { const parts = mm[1].split('||').map(s => s.trim()); let first = true; for (const p of parts) { const kv = p.match(/^(title|module|role|status|view):\s*(.*)$/i); if (kv) meta[kv[1].toLowerCase()] = kv[2]; else if (first) meta.title = p; first = false; } continue; }
    if (/^flowchart\s+/i.test(t) || t.startsWith('%%') || t.startsWith('classDef') || t.startsWith('class ')) continue;
    let em = t.match(/^(.+?)\s+--\s+(.+?)\s+-->\s+(.+)$/), from, to, label = '';
    if (em) { from = parseToken(em[1]); label = em[2].trim(); to = parseToken(em[3]); }
    else { em = t.match(/^(.+?)\s*-->\s*(.+)$/); if (!em) { touch(parseToken(t)); continue; } from = parseToken(em[1]); to = parseToken(em[2]); }
    touch(from); touch(to);
    if (from.id && to.id) edges.push({ from: from.id, to: to.id, label });
  }
  const view = (meta.view || (/role/i.test(meta.module) ? 'role' : 'module')).toLowerCase();
  return { key: file.replace(/\.mmd$/, ''), title: meta.title, module: meta.module, role: meta.role, status: meta.status, view: view, nodes: order.map(id => nodes[id]), edges };
}
let files = [];
try { files = readdirSync(FLOWS).filter(f => f.endsWith('.mmd')).sort(); } catch { files = []; }
if (!files.length) { console.error('No .mmd files in ' + FLOWS); process.exit(1); }
const WORKFLOWS = files.map(parseFlow);
const idx = readFileSync(join(SRC, 'index.html'), 'utf8');
const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
const app = readFileSync(join(SRC, 'app.js'), 'utf8');
const wfjs = 'const WORKFLOWS = ' + JSON.stringify(WORKFLOWS) + ';\nconst STAFF = ' + JSON.stringify(STAFF) + ';\nconst ROLES = ' + JSON.stringify(ROLES) + ';\n';
writeFileSync(join(SRC, 'workflows.js'), wfjs);
const out = idx
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>\n' + css + '\n</style>')
  .replace('<script src="workflows.js"></script>', () => '<script>\n' + wfjs + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>\n' + app + '\n</script>');
writeFileSync(OUT, out);
copyFileSync(OUT, OUT_OFFLINE);
console.log('Workflows: ' + WORKFLOWS.length + ' | roles: ' + ROLES.length);
WORKFLOWS.forEach(w => console.log('  - [' + w.view + '] ' + w.title + '  (' + w.nodes.length + 'n/' + w.edges.length + 'e)'));
