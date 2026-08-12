// gate-all.mjs — RUN EVERY GATE AND RECORD WHAT IT ACTUALLY DID.
//
// The character sheet needs to say "a machine tried to break this code and failed". That claim is only
// worth anything if the numbers behind it were produced by a run rather than typed by whoever wanted
// the claim to be true. So this runs the gates and writes `witness.results.json`, and the sheet reads
// that file. If it is missing or stale, the sheet says so and the rung does not hold.
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// Where the gate itself lives. CI sets WITNESS to a freshly-cloned, tag-pinned copy; locally it falls
// back to the working checkout. The path is an input precisely so the CI run is not quietly using a
// different checker from the one the author ran.
const WITNESS = process.env.WITNESS || 'C:/Users/sjgan/Downloads/witness/witness.mjs';

const KERNELS = [
  { file: 'loadout.mjs',    test: 'node loadout.test.mjs',    baseline: 'witness.loadout.baseline.json' },
  { file: 'endgame.mjs',    test: 'node endgame.test.mjs',    baseline: 'witness.endgame.baseline.json' },
  { file: 'organcheck.mjs', test: 'node organcheck.test.mjs', baseline: 'witness.organcheck.baseline.json' },
  { file: 'find.mjs',       test: 'node find.test.mjs',       baseline: 'witness.find.baseline.json' },
  // The four business organs share one suite, so each is mutated against the whole of it.
  { file: 'organs/ledger.mjs',   test: 'node seats.test.mjs', baseline: 'witness.ledger.baseline.json' },
  { file: 'organs/pipeline.mjs', test: 'node seats.test.mjs', baseline: 'witness.pipeline.baseline.json' },
  { file: 'organs/deadline.mjs', test: 'node seats.test.mjs', baseline: 'witness.deadline.baseline.json' },
  { file: 'organs/roster.mjs',   test: 'node seats.test.mjs', baseline: 'witness.roster.baseline.json' },
];

const runs = [];
for (const k of KERNELS) {
  let out = '';
  try {
    out = execFileSync('node', [WITNESS, 'mutate', k.file, '--cap', '400', '--baseline', k.baseline, '--test', k.test],
      { cwd: HERE, encoding: 'utf8', maxBuffer: 1e8 });
  } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }

  const killed = Number((out.match(/"killed":\s*(\d+)/) || out.match(/(\d+)\s*\/\s*\d+\s+killed/) || [])[1] || 0);
  const score = Number((out.match(/"score":\s*([\d.]+)/) || [])[1] || 0);
  const clean = /"clean":\s*true/.test(out);

  // A survivor is only acceptable when someone wrote down WHY it is equivalent. One without a reason
  // is an open hole, and it is counted separately so it can never be quietly folded into the total.
  let baselined = [], unexplained = 0;
  const bp = join(HERE, k.baseline);
  if (existsSync(bp)) {
    try {
      baselined = JSON.parse(readFileSync(bp, 'utf8'));
      unexplained = baselined.filter(b => !b.reason || String(b.reason).trim().length < 20).length;
    } catch { unexplained = 1; }
  }
  // ⚑ THE SURVIVORS ARE THE PRODUCT WHEN A GATE IS NOT CLEAN. An earlier version of this kept only
  // the score, so "NOT CLEAN" arrived with no way to act on it — a summary that tells you something
  // is wrong and not what is a worse artefact than no summary.
  const survivors = [...out.matchAll(/"line":\s*(\d+),\s*"mutation":\s*"([^"]*)",\s*"snippet":\s*"((?:[^"\\]|\\.)*)"/g)]
    .map(m => ({ line: +m[1], mutation: m[2], snippet: m[3].slice(0, 120) }));

  runs.push({ kernel: k.file, killed, score, clean, baselined: baselined.length, unexplained, survivors });
  console.log(`${k.file.padEnd(16)} killed ${String(killed).padStart(3)} · score ${score} · ${clean ? 'CLEAN' : 'NOT CLEAN'} · baselined ${baselined.length} · unexplained ${unexplained}`);
}

const record = {
  ran: new Date().toISOString().slice(0, 10),
  runs,
  killed: runs.reduce((s, r) => s + r.killed, 0),
  unexplained: runs.reduce((s, r) => s + r.unexplained, 0),
  allClean: runs.every(r => r.clean),
};
writeFileSync(join(HERE, 'witness.results.json'), JSON.stringify(record, null, 1));
console.log(`\ntotal killed ${record.killed} · unexplained ${record.unexplained} · all clean ${record.allClean}`);
