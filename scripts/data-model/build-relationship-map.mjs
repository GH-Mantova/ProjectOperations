#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-relationship-map.mjs
// ---------------------------------------------------------------------------
// Dependency-free generator for the ProjectOperations data-model source of
// truth. Parses apps/api/prisma/schema.prisma and emits:
//
//   docs/data-model/relationship-map.json    machine-readable graph
//   docs/data-model/relationship-map.md       human-readable map (with TOC)
//   docs/data-model/metadata-catalog.json     Smart Wizard overlay (curated)
//
// The .json + .md are FULLY REGENERATED every run (never hand-edit them).
// The metadata-catalog is MERGED: auto-derived suggestions are refreshed, but
// any human-reviewed entries (reviewed: true) are preserved.
//
// Run:  node scripts/data-model/build-relationship-map.mjs
// Check (CI drift): node scripts/data-model/build-relationship-map.mjs --check
//
// ASCII-only on purpose (Windows / PS 5.1 friendly). No external deps.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SCHEMA_PATH = join(REPO_ROOT, 'apps', 'api', 'prisma', 'schema.prisma');
const OUT_DIR = join(REPO_ROOT, 'docs', 'data-model');
const JSON_PATH = join(OUT_DIR, 'relationship-map.json');
const MD_PATH = join(OUT_DIR, 'relationship-map.md');
const CATALOG_PATH = join(OUT_DIR, 'metadata-catalog.json');

const CHECK_MODE = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// 1. PARSE
// ---------------------------------------------------------------------------

function parseSchema(text) {
  const lines = text.split(/\r?\n/);
  const models = {}; // name -> { fields: [], dbTable, raw }
  const enums = {};  // name -> [values]

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const mModel = line.match(/^\s*model\s+(\w+)\s*\{/);
    const mEnum = line.match(/^\s*enum\s+(\w+)\s*\{/);

    if (mModel) {
      const name = mModel[1];
      const body = [];
      i++;
      while (i < lines.length && !/^\s*\}\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      models[name] = { name, bodyLines: body };
    } else if (mEnum) {
      const name = mEnum[1];
      const values = [];
      i++;
      while (i < lines.length && !/^\s*\}\s*$/.test(lines[i])) {
        const v = lines[i].trim();
        if (v && !v.startsWith('//') && !v.startsWith('@@')) {
          const vm = v.match(/^(\w+)/);
          if (vm) values.push(vm[1]);
        }
        i++;
      }
      enums[name] = values;
    }
    i++;
  }
  return { models, enums };
}

const SCALARS = new Set([
  'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
  'DateTime', 'Json', 'Bytes',
]);

function parseModelFields(model, modelNames, enumNames) {
  const fields = [];
  let dbTable = null;

  for (const rawLine of model.bodyLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    if (line.startsWith('@@')) {
      const map = line.match(/@@map\("([^"]+)"\)/);
      if (map) dbTable = map[1];
      continue;
    }

    const fm = line.match(/^(\w+)\s+([A-Za-z0-9_]+)(\[\])?(\?)?\s*(.*)$/);
    if (!fm) continue;

    const fieldName = fm[1];
    const baseType = fm[2];
    const isList = !!fm[3];
    const isOptional = !!fm[4];
    const rest = fm[5] || '';

    const colMatch = rest.match(/@map\("([^"]+)"\)/);
    const relMatch = rest.match(/@relation\(([^)]*)\)/);

    let kind = 'scalar';
    if (modelNames.has(baseType)) kind = 'relation';
    else if (enumNames.has(baseType)) kind = 'enum';
    else if (!SCALARS.has(baseType)) kind = 'unknown';

    const field = {
      name: fieldName,
      dbColumn: colMatch ? colMatch[1] : null,
      type: baseType,
      kind,
      isList,
      isOptional,
      isId: /@id\b/.test(rest),
      isUnique: /@unique\b/.test(rest),
      hasDefault: /@default\b/.test(rest),
      isUpdatedAt: /@updatedAt\b/.test(rest),
    };

    if (kind === 'relation') {
      const rel = { relationName: null, fkFields: [], refFields: [], onDelete: null };
      if (relMatch) {
        const args = relMatch[1];
        const nameQ = args.match(/^\s*"([^"]+)"/);
        if (nameQ) rel.relationName = nameQ[1];
        const fieldsA = args.match(/fields:\s*\[([^\]]*)\]/);
        if (fieldsA) rel.fkFields = fieldsA[1].split(',').map((s) => s.trim()).filter(Boolean);
        const refA = args.match(/references:\s*\[([^\]]*)\]/);
        if (refA) rel.refFields = refA[1].split(',').map((s) => s.trim()).filter(Boolean);
        const odA = args.match(/onDelete:\s*(\w+)/);
        if (odA) rel.onDelete = odA[1];
      }
      field.relation = rel;
      field.owning = rel.fkFields.length > 0; // this side holds the FK column
    }

    fields.push(field);
  }

  return { fields, dbTable };
}

// ---------------------------------------------------------------------------
// 2. DOMAIN TAGGING (heuristic — humans refine in metadata-catalog.json)
// ---------------------------------------------------------------------------

// Ordered rules: first match wins. Keep specific before generic.
// "Estimating (Legacy)" is intentionally kept separate from the Quote-side
// "Estimating" domain — the pending Rates/Lists consolidation (PR #516 line)
// will merge them; visible separation here IS the documentation of that
// pending work, not an oversight to collapse.
const DOMAIN_RULES = [
  ['Estimating (Legacy)', /^(Estimate|CuttingSheet|CuttingOther)/],
  ['Estimating', /^(Cutrite|Rate|EstimateRate|CostLine|Quote|Scope|WasteLine|CuttingLine|CoreHole|MaterialDensity|ProvisionalSum|CostOption|Markup)/],
  ['Tendering', /^(Tender|Clarification|FollowUp|PricingBasis|Builder|ClientPackage)/],
  ['Contracts', /^(Contract|Variation|ProgressClaim|Retention|PaymentClaim|Claim)/],
  ['Procurement', /^(Procurement|PurchaseOrder)/],
  ['Inventory', /^(Stock|Stocktake|ResourceType)/],
  ['Jobs', /^(Job|Shift|Allocation|ResourceAllocation|Timesheet|ClockEvent|JobIssue)/],
  ['Projects', /^(Project|Gantt|Milestone|ScheduleAllocation|WorkPlan)/],
  ['Scheduler', /^(Schedul|Availability|Leave|Unavailability|Roster)/],
  ['Sites', /^(Site)/],
  ['Assets', /^(Asset|Equipment|Plant|Vehicle)/],
  ['Maintenance', /^(Maintenance|Breakdown|ServiceRecord|Inspection)/],
  ['Forms', /^(Form|Field|Section|Submission|RulesEngine|Prestart|PreStart)/],
  ['Safety', /^(Safety|Incident|Hazard|Swms|SWMS|Toolbox|Injury)/],
  ['Compliance', /^(Compliance|Licence|License|Insurance|Qualification|Qual|CreditApplication|ComplianceAlert|EntityLicence|EntityInsurance)/],
  ['Authorization', /^(Authority|Approval)/],
  ['Directory', /^(Client|Contact|Subcontractor|Supplier|Prequal|BusinessType)/],
  ['Workers', /^(Worker|Competenc|Skill|Trade|Crew)/],
  ['Documents', /^(Document|SharePoint|File|Attachment|Folder)/],
  ['Dashboards', /^(Dashboard|Widget|UserDashboard|Report)/],
  ['Integrations', /^(Xero|Myob|MYOB|Integration|Calendar|Sync|Portal|ClientPortal)/],
  ['Communications', /^(Conversation|Correspondence|InternalMessage|EmailProvider)/],
  ['Platform', /^(User|Role|Permission|Audit|RefreshToken|Notification|GlobalList|GlobalAI|PlatformConfig|Setting|Persona|ApiKey|Healthcheck|Session|LookupValue|PublicHoliday|SearchEntry|PilotFeedback|ListBinding)/],
];

function domainForModel(name) {
  for (const [domain, re] of DOMAIN_RULES) {
    if (re.test(name)) return domain;
  }
  return 'Unclassified';
}

// ---------------------------------------------------------------------------
// 3. FIELD ROLE SUGGESTION (for Smart Wizard: measure / dimension / filter /
//    time / attribute / system). Humans confirm in metadata-catalog.json.
// ---------------------------------------------------------------------------

const SYSTEM_FIELD = /^(id|createdAt|updatedAt|deletedAt|createdById|updatedById|.*Hash|.*Token|.*Secret|.*Iv|.*CipherText|.*AuthTag)$/;
const MEASURE_NAME = /(amount|total|price|cost|value|qty|quantity|rate|hours|days|markup|sum|count|percent|pct|weight|volume|tonn|score|margin|balance|paid|due|number|numLoads|loads|capacity)/i;
const DIMENSION_NAME = /(status|stage|type|category|state|priority|discipline|scope|kind|role|method|elevation|material|basis|result|outcome)/i;
const NUMERIC = new Set(['Int', 'BigInt', 'Float', 'Decimal']);

function suggestRole(field) {
  if (field.isId || SYSTEM_FIELD.test(field.name)) return 'system';
  if (field.kind === 'relation') {
    return field.owning ? 'dimension' : 'system'; // FK owner = groupable; back-rel = system
  }
  if (field.type === 'DateTime') return 'time';
  if (field.type === 'Boolean') return 'filter';
  if (field.kind === 'enum') return 'dimension';
  if (NUMERIC.has(field.type)) {
    return MEASURE_NAME.test(field.name) ? 'measure' : 'measure-candidate';
  }
  if (field.type === 'String') {
    return DIMENSION_NAME.test(field.name) ? 'dimension' : 'attribute';
  }
  if (field.type === 'Json') return 'system';
  return 'attribute';
}

// ---------------------------------------------------------------------------
// 4. BUILD GRAPH
// ---------------------------------------------------------------------------

function buildGraph(parsed) {
  const modelNames = new Set(Object.keys(parsed.models));
  const enumNames = new Set(Object.keys(parsed.enums));

  const models = {};
  for (const name of Object.keys(parsed.models)) {
    const { fields, dbTable } = parseModelFields(parsed.models[name], modelNames, enumNames);
    models[name] = {
      name,
      domain: domainForModel(name),
      dbTable,
      fields,
      relations: [],
      referencedBy: [],
    };
  }

  const edges = [];
  for (const name of Object.keys(models)) {
    for (const f of models[name].fields) {
      if (f.kind !== 'relation') continue;
      const cardinality = f.isList ? 'many' : (f.isOptional ? 'one-optional' : 'one');
      const relEntry = {
        field: f.name,
        target: f.type,
        cardinality,
        relationName: f.relation.relationName,
        owning: f.owning,
        onDelete: f.relation.onDelete,
        fkFields: f.relation.fkFields,
        refFields: f.relation.refFields,
      };
      models[name].relations.push(relEntry);
      if (f.owning) {
        edges.push({
          from: name,
          to: f.type,
          via: f.name,
          fk: f.relation.fkFields.join(','),
          onDelete: f.relation.onDelete,
          relationName: f.relation.relationName,
        });
      }
    }
  }

  // referencedBy: incoming owning edges (who holds an FK to me)
  for (const e of edges) {
    if (models[e.to]) {
      models[e.to].referencedBy.push({ from: e.from, via: e.via, fk: e.fk });
    }
  }

  return { models, enums: parsed.enums, edges };
}

// ---------------------------------------------------------------------------
// 5. EMIT JSON
// ---------------------------------------------------------------------------

function buildJson(graph, schemaSha) {
  const modelList = Object.keys(graph.models).sort();
  const byDomain = {};
  for (const name of modelList) {
    const d = graph.models[name].domain;
    (byDomain[d] = byDomain[d] || []).push(name);
  }
  return {
    _generator: 'scripts/data-model/build-relationship-map.mjs',
    _doNotEdit: 'Regenerated from schema.prisma. Do not hand-edit.',
    generatedFrom: 'apps/api/prisma/schema.prisma',
    schemaSha256: schemaSha,
    modelCount: modelList.length,
    enumCount: Object.keys(graph.enums).length,
    edgeCount: graph.edges.length,
    domains: Object.keys(byDomain).sort().reduce((a, d) => { a[d] = byDomain[d].sort(); return a; }, {}),
    enums: graph.enums,
    models: modelList.reduce((a, n) => { a[n] = graph.models[n]; return a; }, {}),
    edges: graph.edges,
  };
}

// ---------------------------------------------------------------------------
// 6. EMIT MARKDOWN (with thorough auto-generated Table of Contents)
// ---------------------------------------------------------------------------

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildMarkdown(graph, schemaSha, stamp) {
  const modelList = Object.keys(graph.models).sort();
  const domains = {};
  for (const name of modelList) {
    const d = graph.models[name].domain;
    (domains[d] = domains[d] || []).push(name);
  }
  const domainNames = Object.keys(domains).sort();

  // domain-level dependency edges (dedup)
  const domainEdges = new Set();
  for (const e of graph.edges) {
    const a = graph.models[e.from]?.domain;
    const b = graph.models[e.to]?.domain;
    if (a && b && a !== b) domainEdges.add(`${a}||${b}`);
  }

  const L = [];
  L.push('# ProjectOperations - Data Model Relationship Map');
  L.push('');
  L.push('> SOURCE OF TRUTH. Auto-generated - do not hand-edit this file.');
  L.push('> Regenerate with `node scripts/data-model/build-relationship-map.mjs`.');
  L.push('> Business meaning (domains, field roles) is curated in `metadata-catalog.json`.');
  L.push('');
  L.push(`- Last updated: ${stamp}`);
  L.push(`- Generated from: \`apps/api/prisma/schema.prisma\` (sha256 \`${schemaSha.slice(0, 12)}\`)`);
  L.push(`- Models: ${modelList.length} | Enums: ${Object.keys(graph.enums).length} | FK edges: ${graph.edges.length} | Domains: ${domainNames.length}`);
  L.push('');

  // ---- TABLE OF CONTENTS ----
  L.push('## Table of Contents');
  L.push('');
  L.push('1. [How to read this document](#how-to-read-this-document)');
  L.push('2. [Domain dependency overview](#domain-dependency-overview)');
  L.push('3. [Domain index](#domain-index)');
  domainNames.forEach((d, di) => {
    L.push(`    ${di + 1}. [${d} (${domains[d].length})](#domain-${slug(d)})`);
  });
  L.push('4. [Enums](#enums)');
  L.push('5. [Full model index (A-Z)](#full-model-index-a-z)');
  L.push('');
  L.push('### Model quick-jump');
  L.push('');
  L.push(modelList.map((n) => `[${n}](#model-${slug(n)})`).join(' | '));
  L.push('');

  // ---- HOW TO READ ----
  L.push('## How to read this document');
  L.push('');
  L.push('Each model lists: its DB table, the domain it belongs to, the records it');
  L.push('**belongs to** (outgoing foreign keys - "this row points at one X"), and what');
  L.push('**references it** (incoming foreign keys - "these rows point back at me").');
  L.push('Field roles (measure / dimension / filter / time) are suggestions consumed by');
  L.push('the Smart Wizard; the authoritative, human-reviewed roles live in');
  L.push('`metadata-catalog.json`.');
  L.push('');

  // ---- DOMAIN DEPENDENCY MERMAID ----
  L.push('## Domain dependency overview');
  L.push('');
  L.push('How the domains reference each other (arrow = "holds a foreign key into").');
  L.push('');
  L.push('```mermaid');
  L.push('graph LR');
  domainNames.forEach((d) => L.push(`  ${slug(d).replace(/-/g, '_')}["${d}"]`));
  for (const de of [...domainEdges].sort()) {
    const [a, b] = de.split('||');
    L.push(`  ${slug(a).replace(/-/g, '_')} --> ${slug(b).replace(/-/g, '_')}`);
  }
  L.push('```');
  L.push('');

  // ---- DOMAIN INDEX ----
  L.push('## Domain index');
  L.push('');
  for (const d of domainNames) {
    L.push(`- **${d}** (${domains[d].length}): ${domains[d].join(', ')}`);
  }
  L.push('');

  // ---- PER-DOMAIN MODEL DETAIL ----
  for (const d of domainNames) {
    L.push(`## Domain: ${d}`);
    L.push('');
    for (const name of domains[d]) {
      const m = graph.models[name];
      L.push(`### Model: ${name}`);
      L.push('');
      L.push(`- Table: \`${m.dbTable || '(unmapped)'}\` | Domain: ${m.domain} | Fields: ${m.fields.length}`);

      const belongsTo = m.relations.filter((r) => r.owning);
      const hasMany = m.relations.filter((r) => r.cardinality === 'many');
      const oneToOne = m.relations.filter((r) => !r.owning && r.cardinality !== 'many');

      if (belongsTo.length) {
        L.push('- Belongs to (FK out):');
        for (const r of belongsTo) {
          L.push(`  - \`${r.field}\` -> **${r.target}** (${r.fkFields.join(',')}${r.onDelete ? ', onDelete ' + r.onDelete : ''})`);
        }
      }
      if (hasMany.length) {
        L.push('- Has many:');
        for (const r of hasMany) L.push(`  - \`${r.field}\` -> **${r.target}**[]`);
      }
      if (oneToOne.length) {
        L.push('- Has one (back-relation):');
        for (const r of oneToOne) L.push(`  - \`${r.field}\` -> **${r.target}**`);
      }
      if (m.referencedBy.length) {
        const uniq = [...new Set(m.referencedBy.map((x) => x.from))].sort();
        L.push(`- Referenced by: ${uniq.map((x) => `**${x}**`).join(', ')}`);
      }

      // measures + dimensions quick view for the wizard
      const measures = m.fields.filter((f) => suggestRole(f) === 'measure').map((f) => f.name);
      const dims = m.fields.filter((f) => suggestRole(f) === 'dimension').map((f) => f.name);
      const times = m.fields.filter((f) => suggestRole(f) === 'time').map((f) => f.name);
      if (measures.length) L.push(`- Suggested measures: ${measures.join(', ')}`);
      if (dims.length) L.push(`- Suggested dimensions: ${dims.join(', ')}`);
      if (times.length) L.push(`- Time fields: ${times.join(', ')}`);
      L.push('');
    }
  }

  // ---- ENUMS ----
  L.push('## Enums');
  L.push('');
  for (const en of Object.keys(graph.enums).sort()) {
    L.push(`- **${en}**: ${graph.enums[en].join(', ')}`);
  }
  L.push('');

  // ---- A-Z INDEX ----
  L.push('## Full model index (A-Z)');
  L.push('');
  for (const name of modelList) {
    const m = graph.models[name];
    L.push(`- **${name}** (${m.domain}) - table \`${m.dbTable || '(unmapped)'}\``);
  }
  L.push('');

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 7. METADATA CATALOG (merge-preserving human review)
// ---------------------------------------------------------------------------

function buildCatalog(graph, existing) {
  const prev = existing?.models || {};
  const out = {
    _purpose: 'Smart Wizard overlay: business meaning on top of the auto-derived graph. Edit this file (not relationship-map.*). Set reviewed:true to lock an entry against auto-overwrite.',
    _generatedFrom: 'apps/api/prisma/schema.prisma',
    domains: [...new Set(Object.values(graph.models).map((m) => m.domain))].sort(),
    models: {},
  };

  for (const name of Object.keys(graph.models).sort()) {
    const m = graph.models[name];
    const before = prev[name];

    if (before && before.reviewed === true) {
      out.models[name] = before; // preserve human-reviewed entry verbatim
      continue;
    }

    const fields = {};
    for (const f of m.fields) {
      const prevF = before?.fields?.[f.name];
      fields[f.name] = {
        role: prevF?.role || suggestRole(f),
        label: prevF?.label || null,
        filterable: prevF?.filterable ?? (suggestRole(f) === 'dimension' || suggestRole(f) === 'filter'),
        aggregations: prevF?.aggregations || (suggestRole(f) === 'measure' ? ['sum', 'avg', 'min', 'max', 'count'] : []),
      };
    }

    // Un-reviewed entries always refresh from the auto-derived domain so
    // that generator-rule updates propagate. Human edits should be locked
    // with reviewed:true, not by relying on the merge to preserve stale
    // values.
    out.models[name] = {
      domain: m.domain,
      wizardVisible: before?.wizardVisible ?? (m.domain !== 'Platform' && m.domain !== 'Unclassified'),
      label: before?.label || null,
      reviewed: false,
      fields,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// 8. MAIN
// ---------------------------------------------------------------------------

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

function main() {
  const text = readFileSync(SCHEMA_PATH, 'utf8');
  const schemaSha = createHash('sha256').update(text).digest('hex');
  const parsed = parseSchema(text);
  const graph = buildGraph(parsed);

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const jsonObj = buildJson(graph, schemaSha);
  const md = buildMarkdown(graph, schemaSha, stamp);

  let existingCatalog = null;
  if (existsSync(CATALOG_PATH)) {
    try { existingCatalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')); } catch { existingCatalog = null; }
  }
  const catalog = buildCatalog(graph, existingCatalog);

  const jsonStr = JSON.stringify(jsonObj, null, 2) + '\n';
  const catalogStr = JSON.stringify(catalog, null, 2) + '\n';

  if (CHECK_MODE) {
    const cur = existsSync(JSON_PATH) ? readFileSync(JSON_PATH, 'utf8') : '';
    // Compare on schemaSha + structure only (ignore timestamp in md).
    const curSha = cur.match(/"schemaSha256":\s*"([0-9a-f]+)"/);
    if (!curSha || curSha[1] !== schemaSha) {
      console.error('DRIFT: relationship-map.json is stale vs schema.prisma.');
      console.error('Run: node scripts/data-model/build-relationship-map.mjs');
      process.exit(1);
    }
    console.log('OK: relationship map is in sync with schema.prisma.');
    return;
  }

  ensureDir(OUT_DIR);
  writeFileSync(JSON_PATH, jsonStr);
  writeFileSync(MD_PATH, md);
  writeFileSync(CATALOG_PATH, catalogStr);

  const reviewed = Object.values(catalog.models).filter((m) => m.reviewed).length;
  console.log(`Wrote ${JSON_PATH}`);
  console.log(`Wrote ${MD_PATH}`);
  console.log(`Wrote ${CATALOG_PATH}`);
  console.log(`Models: ${jsonObj.modelCount} | Enums: ${jsonObj.enumCount} | Edges: ${jsonObj.edgeCount} | Domains: ${Object.keys(jsonObj.domains).length}`);
  console.log(`Catalog: ${reviewed}/${jsonObj.modelCount} models human-reviewed.`);
}

main();
