// Read the BYTES, not PowerShell's decoding of them.
// PS 5.1 Get-Content decodes BOM-less files as Windows-1252, so it will happily SHOW you
// mojibake for a file that is perfectly valid UTF-8 on disk. Diagnosing corruption from
// that output is how you invent an outage (LL-37). Node reads UTF-8 correctly.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = [
  "sot/README.md",
  "sot/01-charter-and-architecture.md",
  "sot/05-decisions-and-lessons.md",
];

for (const f of files) {
  const buf = readFileSync(f);
  const text = buf.toString("utf8");

  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const fffd = (text.match(/�/g) || []).length;
  // Mojibake signature: UTF-8 bytes decoded as cp1252 then re-encoded (— becomes â€”)
  const moji = (text.match(/â€|Ã¢|Â /g) || []).length;
  const emdash = (text.match(/—/g) || []).length;
  const arrow = (text.match(/→/g) || []).length;

  const main = execSync(`git show origin/main:${f}`, { encoding: "buffer", maxBuffer: 64e6 })
    .toString("utf8");
  const mainEm = (main.match(/—/g) || []).length;
  const mainArrow = (main.match(/→/g) || []).length;

  console.log(f);
  console.log(`   BOM=${bom}  U+FFFD=${fffd}  mojibake=${moji}`);
  console.log(`   em-dash  tree=${emdash}  main=${mainEm}`);
  console.log(`   arrow    tree=${arrow}  main=${mainArrow}`);
  console.log(`   verdict: ${fffd === 0 && moji === 0 ? "CLEAN UTF-8 on disk" : "*** DAMAGED ***"}`);
  console.log("");
}
