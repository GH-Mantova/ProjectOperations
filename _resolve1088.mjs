import fs from 'node:fs';

const edits = [
  {
    file: 'apps/api/prisma/schema.prisma',
    repl: [
      '  clientCards     SorClientRateCard[]',
      '  // SoR S4: job/tender snapshots locked against this period.',
      '  snapshots       JobSorSnapshot[]',
    ].join('\n'),
  },
  {
    file: 'apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts',
    repl: [
      '    SorSourceMarkupController,',
      '    JobSorSnapshotController',
      '  ],',
      '  providers: [ScheduleOfRatesService, SorClientRateCardService, SorSourceMarkupService, JobSorSnapshotService],',
      '  exports: [ScheduleOfRatesService, SorClientRateCardService, SorSourceMarkupService, JobSorSnapshotService]',
    ].join('\n'),
  },
];

const re = /<<<<<<< HEAD[\s\S]*?>>>>>>> origin\/main/g;
let ok = true;
for (const e of edits) {
  let s = fs.readFileSync(e.file, 'utf8');
  const m = s.match(re);
  if (!m || m.length !== 1) { console.log('UNEXPECTED marker count in ' + e.file + ': ' + (m ? m.length : 0)); ok = false; continue; }
  s = s.replace(re, e.repl);
  if (s.includes('<<<<<<<') || s.includes('=======') || s.includes('>>>>>>>')) { console.log('MARKER REMAINS in ' + e.file); ok = false; }
  fs.writeFileSync(e.file, s);
  console.log('resolved ' + e.file);
}
console.log(ok ? 'ALL OK' : 'PROBLEMS');
