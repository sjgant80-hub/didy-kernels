// organcheck.test.mjs — PROOF-OF-PLAY for the instrument.
//
// Gate the instrument, not just the thing it measures. This one decides which gear may be equipped,
// so a hole here is a hole in every loadout downstream — and the specific failure it exists to prevent
// is a scanner that fires on a WORD instead of a USE, because the fix for that is always tempting and
// always the same: declare the false positive away and call the gate clean.
import { code, reaches, declaration, admit } from './organcheck.mjs';
import { grant } from './organs/capability.mjs';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const decl = (caps, name = 'thing', does = 'a thing') => `/* --- organ\n * name: ${name}\n * does: ${does}\n * caps: ${caps}\n * --- */\n`;

console.log('\n=== §1 · ⚑ NAMING A THING IS NOT USING IT ===');
{
  // The exact false positive that made skill.mjs the wrong instrument: capability.mjs lists resource
  // names as strings, and a prose scanner called that clipboard access.
  const src = `export const RESOURCES = ['filesystem','network','env','shell','clipboard','browser','database'];`;
  const r = reaches(src);
  ok(r.length === 0, 'a list of resource NAMES reaches for nothing');
  ok(!r.some(x => x.resource === 'clipboard'), 'specifically, the string "clipboard" is not clipboard access');

  const commented = `// this deliberately does NOT fetch( anything, and never touches process.env\nexport const x = 1;`;
  ok(reaches(commented).length === 0, 'a comment saying it does not fetch does not count as fetching');

  const stringly = `const msg = "run child_process to do that"; const t = 'process.env';`;
  ok(reaches(stringly).length === 0, 'and neither do string literals that merely mention the API');
}

console.log('\n=== §2 · a real use IS caught ===');
{
  const cases = [
    [`import { readFileSync } from 'node:fs';`, 'filesystem'],
    [`const r = await fetch(u);`, 'network'],
    [`const k = process.env.KEY;`, 'env'],
    [`import { execSync } from 'node:child_process';`, 'shell'],
    [`await navigator.clipboard.writeText(s);`, 'clipboard'],
    [`const db = indexedDB.open('x');`, 'database'],
    [`const f = new Function('return 1');`, 'skill_invoke'],
  ];
  let all = true;
  for (const [src, res] of cases) {
    if (!reaches(src).some(a => a.resource === res)) { all = false; console.log(`    (missed ${res} in «${src}»)`); }
  }
  ok(all, 'fs, fetch, env, child_process, clipboard, indexedDB and new Function are each detected');
  ok(reaches(`import { writeFileSync } from 'node:fs';`).some(a => a.resource === 'filesystem' && a.level === 'write'),
     'and writing is separated from reading');
  ok(reaches(`const r = await fetch(u);`)[0].evidence.includes('fetch'),
     'every finding carries the fragment that fired it, so it can be checked rather than believed');
}

console.log('\n=== §3 · the declaration is read, or refused ===');
{
  const d = declaration(decl('filesystem:read, network:read'));
  ok(d.ok && d.caps.filesystem === 'read' && d.caps.network === 'read', 'two capabilities parse');
  ok(declaration('export const x=1;').ok === false, 'a file with no declaration block is refused, not assumed empty');
  const bad = declaration(decl('filesystem:banana'));
  ok(bad.problems.length === 1 && /not a level/.test(bad.problems[0]), 'an invalid level is reported rather than dropped');
  ok(bad.caps.filesystem === undefined, '⚑ and NOT stored — rank() returns 0 for an unknown level, so a typo would otherwise become a real declaration that merely ranks as harmless');
  ok(declaration(decl('teapot:read')).problems.length === 1, 'and so is a resource that does not exist');
  ok(declaration(decl('teapot:read')).caps.teapot === undefined, 'also not stored');
  ok(declaration(decl('none')).declaredNothing === true, '"none" is a positive claim to touch nothing');
  ok(declaration(decl('none')).hasCaps === true, 'and it counts as HAVING declared');
}

console.log('\n=== §4 · ⚑ NO CAPS LINE IS NOT "caps: none" ===');
{
  const missing = `/* --- organ\n * name: x\n * does: y\n * --- */\nexport const a = 1;`;
  const r = admit(missing);
  ok(!r.admitted, 'an organ with no caps line is refused');
  ok(r.problems.some(p => /has not declared/.test(p.why)), 'because silence is not a declaration');
  const none = admit(decl('none') + `export const a = 1;`);
  ok(none.admitted, 'whereas "caps: none" over code that touches nothing IS admitted');
  ok(/reaches for nothing/.test(none.verdict), 'and the verdict says so plainly');
}

console.log('\n=== §5 · ⚑ THE CONTRADICTION IS REFUSED ===');
{
  const lying = decl('none') + `import { readFileSync } from 'node:fs';\nconst k = process.env.SECRET;`;
  const r = admit(lying);
  ok(!r.admitted, 'code that reads the disk and the environment while declaring nothing is refused');
  ok(r.undeclared.length === 2, 'both contradictions are named');
  // The property is that the quoted fragment is REALLY IN THE FILE — not which of several equivalent
  // alternatives the regex happened to match first, which is an implementation detail and would make
  // this test fail every time the signal list is reordered.
  ok(r.undeclared.every(u => u.evidence && lying.includes(u.evidence)),
     'with evidence quoted verbatim from the source, so it can be located rather than believed');
  ok(/REFUSED/.test(r.verdict), 'and the verdict is not a score to be argued with');

  const under = admit(decl('filesystem:read') + `import { writeFileSync } from 'node:fs';`);
  ok(!under.admitted, 'declaring read while writing is refused — the LEVEL matters, not just the resource');
}

console.log('\n=== §6 · ⚑ OVER-DECLARING IS ALSO A DEFECT ===');
{
  const greedy = admit(decl('shell:admin, filesystem:read') + `import { readFileSync } from 'node:fs';`);
  ok(!greedy.admitted, 'claiming the shell without touching it is refused');
  ok(greedy.unused.some(u => u.resource === 'shell'), 'the unused claim is named');
  ok(greedy.problems.some(p => p.kind === 'over_declared' && /inherits it for nothing/.test(p.why)),
     'and the reason given is the real one: every build it joins would inherit it');
}

console.log('\n=== §7 · the character\'s grant still bounds it ===');
{
  const own = grant({ filesystem: 'read', network: 'read' }, { calls: 10, spend: 1 });
  const fits = admit(decl('filesystem:read') + `import { readFileSync } from 'node:fs';`, own);
  ok(fits.admitted, 'an organ inside the grant is admitted');
  const over = admit(decl('shell:admin') + `import { execSync } from 'node:child_process';`, own);
  ok(!over.admitted, 'an organ wanting more than the character holds is refused');
  ok(over.outsideGrant.length === 1 && /character holds/.test(over.problems.find(p => p.kind === 'over_grant').why),
     'and it is refused for THAT reason, stated in the character\'s terms');
}

console.log('\n=== §8 · ⚑ THERE IS NO WAY TO CLAIM ADMISSION ===');
{
  // The hole this file exists to close: an endpoint that took `proven` from the caller.
  //
  // NB an earlier version of this test scanned the SOURCE for the word "proven" and failed on the
  // comment explaining that nothing can pass it in. A test that reads prose tests the prose. The
  // property is behavioural, so it is checked behaviourally.
  ok(admit.length <= 3, 'admit() takes source, an optional grant, and an optional name — no verdict parameter');
  const claiming = decl('none') + `export const proven = true; export const admitted = true; export const trusted = true;`;
  ok(admit(claiming).admitted === true, 'a file may declare itself proven — the fields are simply not read');
  const claimingAndLying = decl('none') + `export const proven = true;\nimport { execSync } from 'node:child_process';`;
  ok(admit(claimingAndLying).admitted === false, '⚑ and claiming to be proven does not save code that contradicts its declaration');
}

console.log('\n=== §10 · the report says what it found, in the words it found it ===');
{
  // Each of these was a mutant that survived: the wording and the fallbacks are load-bearing, because
  // this report is the entire product when an organ is refused.
  const one = admit(decl('none') + `const k = process.env.K;`);
  ok(/has 1 problem,/.test(one.verdict), 'one problem is reported as "1 problem", not "1 problems"');
  const two = admit(decl('none') + `const k = process.env.K;\nimport { readFileSync } from 'node:fs';`);
  ok(/has 2 problems,/.test(two.verdict), 'and two as "2 problems"');

  ok(one.undeclared[0].declaredAs === 'nothing', '⚑ a resource that was never mentioned reports as "nothing", not undefined');
  ok(/declared nothing/.test(one.problems.find(p => p.kind === 'undeclared').why), 'and the sentence reads "declared nothing"');

  // An organ that declares a capability it never touches, ALONGSIDE one it does. The unused one must
  // still be caught — a real use of filesystem must not excuse an idle claim on the network.
  const mixed = admit(decl('filesystem:read, network:read') + `import { readFileSync } from 'node:fs';`);
  ok(!mixed.admitted && mixed.unused.length === 1 && mixed.unused[0].resource === 'network',
     '⚑ an unused claim is caught even when a DIFFERENT capability is genuinely used at the same level');
}

console.log('\n=== §11 · naming: declared, given, or plainly unnamed ===');
{
  ok(admit('export const x=1;').name === '(unnamed)', 'no declaration at all gives the string "(unnamed)"');
  ok(typeof admit('export const x=1;').name === 'string', '⚑ a string — never the fields object, which is truthy and would render as [object Object]');
  ok(admit('export const x=1;', null, 'walk.mjs').name === 'walk.mjs', 'a name passed in is used when the file declares none');
  ok(admit(decl('none', 'capability') + 'export const x=1;', null, 'wrong.mjs').name === 'capability',
     'and the DECLARED name wins over the one passed in — the file speaks for itself');
  ok(admit(decl('none', 'capability', 'the lattice') + 'export const x=1;').does === 'the lattice', 'the "does" line is carried through');
  ok(admit('export const x=1;').does === null, 'and is null when there is nothing to carry');
}

console.log('\n=== §9 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, '/* --- organ', '/* --- organ\n--- */', decl(''), decl(',,,'), ' '];
  let threw = null;
  for (const j of junk) { try { admit(j); reaches(j); declaration(j); code(j); } catch (e) { threw = `${String(j).slice(0,20)} → ${e.message}`; } }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(admit(null).admitted === false, 'and nothing is admitted by accident');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
