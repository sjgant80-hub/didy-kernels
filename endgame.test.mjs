// endgame.test.mjs — PROOF-OF-PLAY for the ceiling.
//
// If the endgame is designed first, the endgame is the thing most worth attacking: every rung below it
// is derived from these rules, so a hole here propagates all the way down to the tutorial. The tests
// are therefore aimed at the two ways a level system lies — awarding what was not earned, and letting
// a high rung stand in for a missing low one.
import { TIERS, MAX, RAIDS, clearRaid, gearState, levelOf, endgame } from './endgame.mjs';
import { SEATS } from './loadout.mjs';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

// A full-evidence fixture: everything true, so any single field can be knocked out to test one rung.
const FULL = () => ({
  running: true, organs: ['a', 'b'],
  purse: { bounded: true },
  face: { id: 'abc123', signed: true },
  inspector: { refuses: true },
  gate: { killed: 41, unexplained: 0 },
  gear: { filled: SEATS.length, selfDeclared: 0 },
  evidence: { reproducible: true, selfGraded: false },
  raids: {
    solo: { killed: 41, unexplained: 0 },
    duo: { results: 4, trustedFirst: false },
    wire: { serialised: true, functionsCrossed: false, pointersOnly: true },
    pub: { peers: 3, allVerified: true, differentGates: true, liarPresent: true, liarGained: 0, gained: 2, keptAfterClosing: true },
  },
});

console.log('\n=== §1 · the ladder is a ladder ===');
{
  ok(TIERS.length === MAX && MAX === 10, 'ten rungs');
  ok(TIERS.every((t, i) => t.n === i + 1), 'numbered without gaps');
  ok(TIERS.every(t => t.is && t.name && typeof t.holds === 'function'), 'each rung says what it is and how it is checked');
  const alone = TIERS.filter(t => t.alone).map(t => t.n);
  ok(alone.join(',') === '1,2,3,4', 'exactly the first four can be established alone — the break-point is stated in the data, not in prose');
}

console.log('\n=== §2 · ⚑ THERE IS NO SETTER ===');
{
  const src = readFileSync(new URL('./endgame.mjs', import.meta.url), 'utf8');
  // The property, checked behaviourally rather than by reading the prose: passing a tier in is ignored.
  const claimed = levelOf({ tier: 10, level: 10, name: 'Sovereign', maxed: true });
  ok(claimed.tier === 0, 'asking for tier 10 with no evidence returns 0 — the request is not an input, it is noise');
  ok(claimed.maxed === false, 'and maxed stays false');
  const full = levelOf({ ...FULL(), tier: 1 });
  ok(full.tier === MAX, 'and asking for tier 1 while holding full evidence still returns MAX — the field is read by nothing');
  ok(!/export function (set|award|grant)(Level|Tier)/.test(src), 'no exported setter exists');
}

console.log('\n=== §3 · ⚑ YOU CANNOT SKIP A RUNG ===');
{
  const e = FULL();
  delete e.purse;                                     // knock out rung 2, leave 3–10 true
  const l = levelOf(e);
  ok(l.tier === 1, 'a gap at 2 caps the character at 1, however much is true above it');
  ok(l.trueButNotCounted.length >= 7, 'the higher rungs are reported as true-but-not-counted rather than silently dropped');
  ok(!l.trueButNotCounted.includes('Awake'), 'and a rung you have ALREADY been credited with is not listed again as uncounted');
  ok(!l.trueButNotCounted.includes('Bounded'), 'nor is the rung that is blocking you, which by definition does not hold');
  ok(/Bounded/.test(l.blocking.name), 'and the one thing in the way is named');
  ok(!l.maxed, 'not maxed');
}

console.log('\n=== §4 · full evidence reaches MAX, and nothing less does ===');
{
  const l = levelOf(FULL());
  ok(l.tier === MAX && l.maxed === true, 'every rung holding gives 10/10');
  ok(/MAX \(10\/10\) — Sovereign/.test(l.line), 'and says so plainly');
  ok(l.blocking === null, 'with nothing blocking');

  // Each rung knocked out in turn must lower the ceiling to exactly below it.
  const knock = [
    ['running', 0], ['purse', 1], ['face', 2], ['inspector', 3],
    ['gate', 4], ['gear', 5], ['evidence', 9],
  ];
  let allCapped = true;
  for (const [field, expect] of knock) {
    const e = FULL(); delete e[field];
    if (levelOf(e).tier !== expect) { allCapped = false; console.log(`    (${field} → ${levelOf(e).tier}, expected ${expect})`); }
  }
  ok(allCapped, 'removing any single piece of evidence caps the level at exactly the rung below it');
}

console.log('\n=== §5 · the raids refuse an empty record ===');
{
  let allRefuse = true;
  for (const r of RAIDS) {
    const a = clearRaid(r.id, null), b = clearRaid(r.id, {}), c = clearRaid(r.id, undefined);
    if (a.cleared || b.cleared || c.cleared) { allRefuse = false; console.log(`    (${r.id} cleared on an empty record)`); }
  }
  ok(allRefuse, 'no raid is cleared by null, undefined, or an empty object — absence of evidence is not evidence');
  ok(!clearRaid('the-easy-one', { peers: 99 }).cleared, 'and an unknown raid id is refused rather than assumed');
  ok(/no raid called/.test(clearRaid('the-easy-one', {}).why), 'by name');
}

console.log('\n=== §6 · the gate raid: killing nothing is not passing ===');
{
  ok(!clearRaid('solo', { killed: 0, unexplained: 0 }).cleared, 'a gate that killed nothing does not clear it');
  ok(/not evidence, it is a green light/.test(clearRaid('solo', { killed: 0, unexplained: 0 }).why), 'and says why, because this is the most common false green there is');
  ok(!clearRaid('solo', { killed: 40, unexplained: 1 }).cleared, 'one unexplained survivor fails it');
  ok(clearRaid('solo', { killed: 40, unexplained: 0 }).cleared, 'killed with every survivor explained clears it');
}

console.log('\n=== §7 · the handshake raid: two results is trust, four is verification ===');
{
  ok(!clearRaid('duo', { results: 2, trustedFirst: false }).cleared, 'two results does not clear it');
  ok(/you believed them/.test(clearRaid('duo', { results: 2 }).why), 'and names what two results actually is');
  ok(!clearRaid('duo', { results: 4, trustedFirst: true }).cleared, 'four results with one side trusted first does not clear it either');
  ok(clearRaid('duo', { results: 4, trustedFirst: false }).cleared, 'four cross-run results clears it');
}

console.log('\n=== §8 · the wire raid: a function must not cross ===');
{
  ok(!clearRaid('wire', { serialised: false, pointersOnly: true, functionsCrossed: false }).cleared,
     'a same-process channel does not clear it — you may be comparing a function with itself');
  ok(!clearRaid('wire', { serialised: true, functionsCrossed: true, pointersOnly: true }).cleared,
     'a function crossing does not clear it, because that is accepting executable code from a peer');
  ok(!clearRaid('wire', { serialised: true, functionsCrossed: false, pointersOnly: false }).cleared,
     'and neither does an exchange that did not reduce to pointers');
  ok(clearRaid('wire', { serialised: true, functionsCrossed: false, pointersOnly: true }).cleared, 'serialised, pointers only, clears it');
}

console.log('\n=== §9 · ⚑ THE ROOM — the hardest, and every clause earns its place ===');
{
  const good = () => ({ peers: 3, allVerified: true, differentGates: true, liarPresent: true, liarGained: 0, gained: 2, keptAfterClosing: true });
  ok(clearRaid('pub', good()).cleared, 'the full room clears it');

  ok(!clearRaid('pub', { ...good(), peers: 2 }).cleared, 'two peers is a handshake, not a room');
  ok(/a third who can disagree with both/.test(clearRaid('pub', { ...good(), peers: 2 }).why), 'and says what the third is for');
  ok(/^2 peer\(s\)/.test(clearRaid('pub', { ...good(), peers: 2 }).why), 'and reports the count it actually saw, not a placeholder');
  ok(/^0 peer\(s\)/.test(clearRaid('pub', { ...good(), peers: 0 }).why), 'including zero');
  ok(!clearRaid('pub', { ...good(), differentGates: false }).cleared, 'peers running the same gate do not clear it — agreeing with a copy of yourself proves nothing');
  ok(!clearRaid('pub', { ...good(), liarPresent: false }).cleared, '⚑ a room that has never been lied to does not clear it');
  ok(!clearRaid('pub', { ...good(), liarGained: 1 }).cleared, '⚑ and a liar who gained anything FAILS it outright');
  ok(!clearRaid('pub', { ...good(), gained: 0 }).cleared, 'leaving with what you came with does not clear it');
  ok(!clearRaid('pub', { ...good(), keptAfterClosing: false }).cleared, 'and a gain the room keeps means the room is a landlord');

  const hardest = RAIDS[RAIDS.length - 1];
  ok(hardest.id === 'pub' && hardest.party === 3, 'the room is last and needs a party');
  ok(hardest.tier === 9, 'and it is what rung 9 means');
}

console.log('\n=== §10 · gear: self-declared is counted separately, on purpose ===');
{
  const full = SEATS.map(s => ({ seat: s.id, admittedBy: 'inspection' }));
  const g = gearState(full);
  ok(g.filled === 8 && g.selfDeclared === 0, 'eight inspected items fill eight seats with nothing self-declared');
  ok(levelOf({ ...FULL(), gear: g }).tier === MAX, 'and that reaches MAX');

  const claimed = SEATS.map(s => ({ seat: s.id, admittedBy: 'the item said so' }));
  const c = gearState(claimed);
  ok(c.filled === 8 && c.selfDeclared === 8, '⚑ eight items that certified themselves fill all eight seats and count as eight self-declarations');
  ok(levelOf({ ...FULL(), gear: c }).tier === 5, '⚑ and a fully-equipped character whose gear graded itself is capped at 5 — a full sheet is not a proven one');
  ok(gearState([{ seat: 'nowhere', admittedBy: 'inspection' }]).filled === 0, 'an item in a seat that does not exist fills nothing');
  ok(gearState([]).empty.length === 8, 'and an empty loadout names all eight empty seats');
}

console.log('\n=== §11 · pure under garbage — a predicate that throws is a NO, never a crash ===');
{
  const junk = [null, undefined, 0, '', 'x', [], NaN, { raids: null }, { raids: 'no' }, { gate: 'yes' },
                { organs: 'not-an-array' }, { purse: { bounded: 'true' } }, { face: { id: 7, signed: true } }];
  let threw = null;
  for (const j of junk) { try { endgame(j); levelOf(j); } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; } }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(levelOf({ purse: { bounded: 'true' } }).tier === 0, 'and the string "true" is not true — a stringly-typed claim earns nothing');
  ok(levelOf({ face: { id: 7, signed: true } }).tier === 0, 'nor is a numeric id a proven identity');
}

console.log('\n=== §12 · the bound is carried in the output, not left to the renderer ===');
{
  const l = levelOf(FULL());
  ok(/self-administered/.test(l.bound), 'the sheet states that rungs 1–6 are self-administered');
  ok(/1–6/.test(l.bound) && /7–10/.test(l.bound), 'and names exactly which are which');
  const e = endgame(FULL());
  ok(e.raids.length === 4 && e.raids.every(r => r.why), 'every raid reports a reason, cleared or not');
  ok(e.hardest.id === 'pub', 'and the hardest is surfaced by name');
  ok(Array.isArray(e.remaining) && e.remaining.length === 0, 'a maxed character has nothing remaining');
  ok(endgame({}).remaining.length === MAX, 'and an unproven one has all ten');
}

console.log('\n=== §13 · every clause in every rung is load-bearing ===');
{
  // The mutation gate found these: with the evidence object PRESENT but its condition false, an `&&`
  // silently flipped to `||` still reported the rung as held. Presence is not proof, and each rung has
  // to be checked with its own container present, or the check is only testing that the field exists.
  const cap = (patch, expect, what) => {
    const e = { ...FULL(), ...patch };
    const got = levelOf(e).tier;
    ok(got === expect, `${what} → capped at ${expect}` + (got === expect ? '' : ` (got ${got})`));
  };
  cap({ running: false }, 0, 'it exists but is not running');
  cap({ organs: [] }, 0, '⚑ awake with ZERO organs is not awake — an empty list is not a list of things');
  cap({ purse: { bounded: false } }, 1, '⚑ a purse that does not bound is not a bound');
  cap({ purse: {} }, 1, 'nor is an empty purse object');
  cap({ face: { id: '', signed: true } }, 2, '⚑ a signed face with an EMPTY id is not an identity');
  cap({ face: { id: 'abc', signed: false } }, 2, 'nor is an unsigned one');
  cap({ inspector: { refuses: false } }, 3, '⚑ an inspector that warns instead of refusing does not count');
  cap({ gate: { killed: 0, unexplained: 0 } }, 4, '⚑ a gate present but killing NOTHING does not count');
  cap({ gate: { killed: 10, unexplained: 2 } }, 4, 'nor one with unexplained survivors');
  cap({ gear: { filled: 7, selfDeclared: 0 } }, 5, 'seven of eight seats is not geared');
  cap({ evidence: { reproducible: false, selfGraded: false } }, 9, '⚑ evidence that cannot be reproduced caps at 9');
  cap({ evidence: { reproducible: true, selfGraded: true } }, 9, '⚑ and self-graded evidence caps at 9 — grading yourself is the one thing rung 10 rules out');
}

console.log('\n=== §14 · unreadable input is reported, not silently scored as zero ===');
{
  // "0/10 because you have done nothing" and "0/10 because what you handed me was junk" look identical
  // on a scoreboard and are completely different facts. The sheet has to distinguish them.
  ok(levelOf(FULL()).usable === true, 'a real evidence object is readable');
  ok(levelOf(null).usable === false, '⚑ null is NOT readable — and typeof null === "object" is exactly the trap that hides this');
  ok(levelOf('nope').usable === false, 'a string is not readable');
  ok(levelOf(7).usable === false, 'nor a number');
  ok(levelOf(null).tier === 0 && levelOf(null).maxed === false, 'and unreadable still scores 0 rather than throwing');
  ok(endgame(null).usable === false && endgame(null).raids.length === 4, 'the full sheet carries the same flag and still lists every raid');
  ok(endgame(FULL()).usable === true, 'and reports true when the evidence was read');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
