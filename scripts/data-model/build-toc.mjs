#!/usr/bin/env node
// ---------------------------------------------------------------------------
// build-toc.mjs
// ---------------------------------------------------------------------------
// Generic, idempotent Table-of-Contents generator/updater for source-of-truth
// Markdown documents. Injects (or refreshes) a TOC between HTML markers:
//
//     <!-- TOC:START -->
//     ...generated...
//     <!-- TOC:END -->
//
// - If the markers already exist, only the content between them is replaced.
// - If they do NOT exist, the block is inserted immediately after the first
//   H1 (a "# " heading), or at the top of the file if there is no H1.
// - Nothing else in the document is touched. Running it twice is a no-op.
//
// Headings included: level 2 (##) and level 3 (###). Level 3 is nested.
// GitHub-style anchor slugs are used.
//
// Usage:
//   node scripts/data-model/build-toc.mjs <file.md> [<file2.md> ...]
//   node scripts/data-model/build-toc.mjs --check <file.md> [...]   # CI
//
// ASCII-only, zero dependencies.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const START = '<!-- TOC:START -->';
const END = '<!-- TOC:END -->';

function slug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');
}

function extractHeadings(lines) {
  const headings = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.*?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    let text = m[2].replace(/[*_`]/g, '').trim();
    if (!text || text === START || text === END) continue;
    if (/^table of contents$/i.test(text)) continue;
    headings.push({ level, text });
  }
  return headings;
}

function buildToc(headings) {
  // De-duplicate anchor slugs the way GitHub does (-1, -2, ...).
  const seen = {};
  const out = [START];
  for (const h of headings) {
    let s = slug(h.text);
    if (seen[s] != null) { seen[s] += 1; s = `${s}-${seen[s]}`; } else { seen[s] = 0; }
    const indent = h.level === 3 ? '  ' : '';
    out.push(`${indent}- [${h.text}](#${s})`);
  }
  out.push(END);
  return out.join('\n');
}

function applyToc(content) {
  const lines = content.split(/\r?\n/);
  const headings = extractHeadings(lines);
  const toc = buildToc(headings);

  if (content.includes(START) && content.includes(END)) {
    const re = new RegExp(`${START}[\\s\\S]*?${END}`);
    return content.replace(re, toc);
  }

  // No markers yet: insert after first H1, else at top.
  const h1Index = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1Index >= 0) {
    lines.splice(h1Index + 1, 0, '', toc);
    return lines.join('\n');
  }
  return `${toc}\n\n${content}`;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((a) => a !== '--check');

  if (files.length === 0) {
    console.error('Usage: node build-toc.mjs [--check] <file.md> [...]');
    process.exit(2);
  }

  let drift = false;
  for (const file of files) {
    if (!existsSync(file)) { console.error(`SKIP (missing): ${file}`); continue; }
    const before = readFileSync(file, 'utf8');
    const after = applyToc(before);
    if (check) {
      if (before !== after) { drift = true; console.error(`STALE TOC: ${file}`); }
      else { console.log(`OK: ${file}`); }
    } else if (before !== after) {
      writeFileSync(file, after);
      console.log(`Updated TOC: ${file}`);
    } else {
      console.log(`No change: ${file}`);
    }
  }
  if (check && drift) {
    console.error('Run: node scripts/data-model/build-toc.mjs <files>');
    process.exit(1);
  }
}

main();
