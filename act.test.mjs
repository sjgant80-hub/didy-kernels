// act.test.mjs — PROOF-OF-PLAY for acting on the wisp.
//
// The failure this kernel exists to prevent is subtle: an agenda that blends a MEASURED gap with an
// INFERRED one reads as a single confident list, and the measurement is what gets diluted. So most of
// these tests are about keeping the two kinds apart and keeping the bound attached.
import { orbits, agenda, excused, exemptionOf, MIN_REASON } from './act.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const node = (name, hot, live, pushed) => ({ name, hot, live, pushed });

console.log('\n=== §1 · ⚑ AN ORBIT IS HOT AND NOT LIVE ===');
{
  const nodes = [
    node('fresh-and-shipped', true, true, '2026-08-10'),
    node('touched-serves-nothing', true, false, '2026-08-11'),
    node('old-and-shipped', false, true, '2025-01-01'),
    node('old-and-dead', false, false, '2025-01-01'),
  ];
  const o = orbits(nodes);
  ok(o.length === 1 && o[0].name === 'touched-serves-nothing', 'only the hot-and-not-live one orbits');
  ok(!o.some(n => n.live), 'a live repo is never an orbit however recently touched');
  ok(!o.some(n => !n.hot), '⚑ and a COLD dead repo is not an orbit either — it is substrate, not a gap');
  ok(orbits(null).length === 0 && orbits([null, undefined]).length === 0, 'garbage orbits nothing');
}

console.log('\n=== §2 · most recently touched first ===');
{
  const o = orbits([node('older', true, false, '2026-07-01'), node('newer', true, false, '2026-08-11')]);
  ok(o[0].name === 'newer', '⚑ the thing you touched YESTERDAY that serves nothing is the cheapest to finish');
  const tie = orbits([node('bravo', true, false, '2026-08-01'), node('alpha', true, false, '2026-08-01')]);
  ok(tie[0].name === 'alpha', 'and an equal date breaks alphabetically, so the order is deterministic');
}

console.log('\n=== §3 · ⚑ MEASURED AND INFERRED ARE NEVER BLENDED ===');
{
  const nodes = [node('orbiting', true, false, '2026-08-11')];
  const shadows = [{ branch: 'build a mesh over sound', times_shadowed: 3 }];
  const a = agenda(nodes, shadows);

  ok(a.agenda[0].kind === 'orbit', '⚑ measured comes FIRST');
  ok(a.agenda[0].evidence === 'measured', 'and is labelled measured');
  ok(a.agenda[1].kind === 'shadow' && a.agenda[1].evidence === 'inferred', 'the inference is labelled inferred');
  ok(a.agenda.every(r => r.evidence), '⚑ every row carries which KIND of claim it is — a reader never has to guess');
  ok(/measured .*· .*inferred/.test(a.line), 'and the summary counts them separately');
  ok(a.orbits === 1 && a.shadows === 1, 'both counts are reported');
}

console.log('\n=== §4 · ⚑ EVERY ROW SAYS WHAT WOULD CLOSE IT ===');
{
  const a = agenda([node('x', true, false, '2026-08-01')], [{ branch: 'y', times_shadowed: 2 }]);
  ok(a.agenda.every(r => r.closes && r.closes.length > 20), 'every row states what closes it');
  ok(/ship a page anyone can open/.test(a.agenda[0].closes), '⚑ and it is CONCRETE — "ship a page", not "improve it"');
  ok(/commit it or write down why not/.test(a.agenda[1].closes), 'a shadow closes by deciding, either way');
  ok(a.agenda.every(r => r.why), 'and every row says why it is on the list');
  ok(/serves no page/.test(a.agenda[0].why), 'with the orbit reason being the measurement itself');
}

console.log('\n=== §5 · ⚑ THE BOUND TRAVELS WITH THE TASK ===');
{
  const a = agenda([node('x', true, false, '2026-08-01')], []);
  ok(/no live page/i.test(a.bound), 'the bound says what "orbit" actually means');
  ok(/NOT mean unused, unfinished or bad/.test(a.bound),
     '⚑ and what it does NOT mean — turning a finding into a task does not upgrade the evidence');
  ok(/cannot be read from repo metadata/.test(a.bound), 'the open residue is restated, not quietly dropped');
}

console.log('\n=== §6 · a circled-once idea is not a pattern ===');
{
  const once = agenda([], [{ branch: 'a passing thought', times_shadowed: 1 }]);
  ok(once.shadows === 0, '⚑ circled ONCE is a passing thought, not something to put on an agenda');
  const twice = agenda([], [{ branch: 'a real one', times_shadowed: 2 }]);
  ok(twice.shadows === 1, 'circled twice counts');
  ok(agenda([], [{ branch: 'x', times_shadowed: 5 }], { minCircled: 6 }).shadows === 0, 'and the threshold is an input');
}

console.log('\n=== §7 · truncation is stated, never silent ===');
{
  const many = Array.from({ length: 25 }, (_, i) => node('n' + i, true, false, '2026-08-01'));
  const a = agenda(many, [], { limit: 10 });
  ok(a.agenda.length === 10, 'the list is capped');
  ok(a.truncated === 15, '⚑ and how many were left off is REPORTED');
  ok(/showing 10 of 25/.test(a.line), 'the line says so, because "10 things to do" reads the same whether it is all of them or not');
  ok(agenda(many.slice(0, 3), [], { limit: 10 }).truncated === 0, 'nothing truncated reports zero');
}

console.log('\n=== §8 · nothing to do is an answer ===');
{
  const empty = agenda([], []);
  ok(empty.agenda.length === 0, 'an empty frontier yields an empty agenda');
  ok(/finished or not moving/.test(empty.line), '⚑ and says which two things that could mean, rather than looking like success');
}

console.log('\n=== §10 · the fields the gate found unguarded ===');
{
  // A node with no push date must still be an orbit — "touched but undated" is a gap, not a non-gap.
  const undated = agenda([node('nodate', true, false, null)], []);
  ok(undated.orbits === 1, 'an orbit with no date is still an orbit');
  ok(/touched recently and serves no page/.test(undated.agenda[0].why),
     '⚑ and reads "touched recently" rather than "touched null" — a placeholder that is not a word is a bug on screen');
  ok(/touched 2026-08-11/.test(agenda([node('d', true, false, '2026-08-11')], []).agenda[0].why),
     'while a real date is used verbatim');

  // Sorting must survive missing dates rather than throwing or shuffling.
  const mixed = orbits([node('undated', true, false, null), node('dated', true, false, '2026-08-01')]);
  ok(mixed.length === 2 && mixed[0].name === 'dated', '⚑ a dated orbit outranks an undated one — absent is not recent');

  // A shadow with no branch falls back to its id, so a row is never blank.
  const byId = agenda([], [{ id: 'sh:0041', times_shadowed: 3 }]);
  ok(byId.agenda[0].what === 'sh:0041', 'a shadow with no branch text shows its id rather than an empty row');
  const noneAtAll = agenda([], [{ times_shadowed: 3 }]);
  ok(noneAtAll.agenda[0].what === '', 'and with neither, it is honestly empty rather than "undefined"');

  // times_shadowed ordering must actually order.
  const order = agenda([], [{ branch: 'twice', times_shadowed: 2 }, { branch: 'five', times_shadowed: 5 }]);
  ok(order.agenda[0].what === 'five', '⚑ the more-circled shadow leads');
  ok(/circled in 5 separate decisions/.test(order.agenda[0].why), 'and the count is reported, not just used');

  // The truncation boundary: exactly at the limit is NOT truncated.
  const exact = agenda(Array.from({ length: 10 }, (_, i) => node('n' + i, true, false, '2026-08-01')), [], { limit: 10 });
  ok(exact.truncated === 0, '⚑ exactly at the limit is not truncated');
  ok(!/showing/.test(exact.line), 'and the line does not claim it is showing a subset');
  const over = agenda(Array.from({ length: 11 }, (_, i) => node('n' + i, true, false, '2026-08-01')), [], { limit: 10 });
  ok(over.truncated === 1 && /showing 10 of 11/.test(over.line), 'one more is');
}

console.log('\n=== §11 · ⚑ AN EXEMPTION IS A SENTENCE, NOT A FLAG ===');
{
  const nodes = [node('the-room', true, false, '2026-08-02'), node('real-gap', true, false, '2026-08-01')];
  const good = { 'the-room': 'PRIVATE by design — a five-seat multi-agent room; a page would publish it' };

  const a = agenda(nodes, [], { exempt: good });
  ok(a.orbits === 1 && a.agenda[0].what === 'real-gap', 'an excused repo leaves the agenda');
  ok(a.excused === 1, '⚑ and is COUNTED — a backlog that silently shrank looks identical to one that got finished');
  ok(a.excusedRows[0].what === 'the-room' && /PRIVATE by design/.test(a.excusedRows[0].why),
     'with its reason returned, so the excuse is a decision on the record');
  ok(/1 excused with a written reason/.test(a.line), 'and the line says so');

  // ⚑ The refusals: a bare name, an empty string, or a two-word excuse are NOT exemptions.
  ok(agenda(nodes, [], { exempt: { 'the-room': true } }).orbits === 2, '⚑ a bare flag excuses nothing');
  ok(agenda(nodes, [], { exempt: { 'the-room': '' } }).orbits === 2, 'nor does an empty reason');
  ok(agenda(nodes, [], { exempt: { 'the-room': 'private' } }).orbits === 2, '⚑ nor a one-word excuse — an excuse is not a reason');
  ok(MIN_REASON >= 20, 'the floor is high enough to require a sentence');
  // ⚑ Exactly at the floor is a reason. An off-by-one here rejects the shortest honest excuse and
  // quietly puts a repo back on the list that someone had already decided about.
  const exact = 'x'.repeat(MIN_REASON), under = 'x'.repeat(MIN_REASON - 1);
  ok(exemptionOf({ n: exact }, 'n') === exact, 'a reason of exactly the minimum length counts');
  ok(exemptionOf({ n: under }, 'n') === null, 'one character shorter does not');
  ok(exemptionOf({ n: '  ' + exact + '  ' }, 'n') === exact, 'and it is measured after trimming, not before');
  ok(exemptionOf(good, 'the-room') !== null && exemptionOf(good, 'real-gap') === null, 'exemptionOf answers per name');
  ok(exemptionOf(null, 'x') === null && exemptionOf({}, 'x') === null, 'a missing table excuses nothing');

  // A live repo is not "excused" — it was never on the list.
  ok(excused([node('shipped', true, true, '2026-08-01')], { shipped: 'a reason long enough to count here' }).length === 0,
     'something already live is not reported as excused — it was never a gap');
  ok(excused(null, good).length === 0 && orbits(null, good).length === 0, 'garbage excuses nothing and orbits nothing');
}

console.log('\n=== §9 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, [null], [{ name: null }]];
  let threw = null;
  for (const j of junk) {
    try { orbits(j); agenda(j, j); agenda([], j); agenda(j, [], j); } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
