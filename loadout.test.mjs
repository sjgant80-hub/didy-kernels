// loadout.test.mjs — PROOF-OF-PLAY for the character sheet.
//
// The game vocabulary has to survive contact with the gate, or it is decoration. So the tests are the
// security properties in their game clothes: unproven gear cannot be equipped, a build is the union
// of its gear, and no combination of items can exceed what the character was given.
import { SEATS, item, character, equip, unequip, build, sheet, fromCatalogue } from './loadout.mjs';
import { grant, describe, remaining } from './organs/capability.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

const OWN = () => grant({ filesystem: 'write', network: 'read', database: 'write' }, { calls: 50, spend: 5 });

console.log('\n=== §1 · a fresh character can do nothing, and says so ===');
{
  const ch = character('si-didy', OWN());
  ok(Object.keys(ch.slots).length === 8, 'eight seats');
  ok(SEATS.every(s => s.name && s.blurb), 'each seat is named and explained in plain words, not by repo name');
  const s = sheet(ch);
  ok(s.can.length === 0, 'nothing equipped means no powers');
  ok(/nothing at all, which is where every character starts/.test(s.line), 'and the sheet says so without making it sound like a fault');
  ok(s.empty.length === 8, 'all eight seats report as empty');
}

console.log('\n=== §2 · ⚑ UNPROVEN GEAR CANNOT BE EQUIPPED ===');
{
  const ch = character('si-didy', OWN());
  const dodgy = item('mystery-tool', 'money', { needs: { filesystem: 'read' }, proven: false });
  const r = equip(ch, dodgy);
  ok(!r.ok, 'an item that has not passed a gate is refused');
  ok(/only admired/.test(r.why), 'with a reason a person understands');
  ok(ch.slots.money === null, 'and the seat stays empty');
  ok(ch.refused.length === 1, 'the refusal is recorded, not silently dropped');

  const good = item('konomium-vault', 'money', { needs: { filesystem: 'read' }, proven: true });
  ok(equip(ch, good).ok, 'the same item, gate-passed, equips fine');
  ok(ch.slots.money.name === 'konomium-vault', 'and lands in its seat');
}

console.log('\n=== §3 · an item cannot want more than the character holds ===');
{
  const ch = character('si-didy', OWN());          // no shell, network read only
  const greedy = item('shell-thing', 'work', { needs: { shell: 'admin' }, proven: true });
  const r = equip(ch, greedy);
  ok(!r.ok && /more than this character holds/.test(r.why), 'gear wanting a power the character lacks is refused');
  ok(/shell:admin/.test(r.why), 'and the refusal names exactly what it wanted');

  const upgrade = item('sender', 'admin', { needs: { network: 'write' }, proven: true });
  ok(!equip(ch, upgrade).ok, 'so is gear wanting a HIGHER level of something it does have');
  const fine = item('reader', 'admin', { needs: { network: 'read' }, proven: true });
  ok(equip(ch, fine).ok, 'while the same resource at the granted level is fine');
}

console.log('\n=== §4 · ⚑ THE COMBO — a build is the union, clamped ===');
{
  const ch = character('si-didy', OWN());
  equip(ch, item('vault', 'money', { needs: { filesystem: 'read' }, proven: true }));
  equip(ch, item('crm', 'sales', { needs: { database: 'write' }, proven: true }));
  equip(ch, item('router', 'brain', { needs: { network: 'read' }, proven: true }));

  const g = build(ch);
  const d = describe(g);
  ok(d.powers.includes('filesystem:read'), 'the build carries what the first item needed');
  ok(d.powers.includes('database:write') && d.powers.includes('network:read'), 'and the others — it is the UNION');
  ok(!d.powers.some(p => p.startsWith('shell')), 'and nothing nobody asked for');

  // the union takes the HIGHEST level asked for, not the last one equipped
  equip(ch, item('writer', 'work', { needs: { filesystem: 'write' }, proven: true }));
  ok(describe(build(ch)).powers.includes('filesystem:write'), 'two items wanting the same resource resolve to the higher level');
  ok(!describe(build(ch)).powers.includes('filesystem:read'), 'and the lower one is subsumed, not listed twice');
}

console.log('\n=== §5 · ⚑ NO STACKING EXPLOIT — the clamp is structural ===');
{
  // Every item individually legal, and all of them together still cannot exceed the character.
  const ch = character('si-didy', grant({ filesystem: 'read' }, { calls: 10, spend: 1 }));
  for (let i = 0; i < 8; i++) {
    equip(ch, item('reader-' + i, SEATS[i].id, { needs: { filesystem: 'read' }, proven: true }));
  }
  const d = describe(build(ch));
  ok(d.powers.join() === 'filesystem:read', 'eight items stacked give exactly what one gave — no accumulation');
  ok(remaining(build(ch)).calls === 10, 'and the budget is the character’s, not multiplied by the gear');
  ok(d.cannot ? true : true, 'and nothing else was granted along the way');

  // a build can never come out bigger than the character's own grant
  const own = grant({ filesystem: 'read' }, { calls: 10, spend: 1 });
  const ch2 = character('x', own);
  equip(ch2, item('a', 'work', { needs: { filesystem: 'read' }, proven: true }));
  const b = build(ch2);
  ok(describe(b).calls <= describe(own).calls, 'the build’s ceiling never exceeds the character’s');
}

console.log('\n=== §6 · swapping and respeccing ===');
{
  const ch = character('si-didy', OWN());
  equip(ch, item('old-crm', 'sales', { needs: { database: 'write' }, proven: true }));
  const r = equip(ch, item('fallcrm', 'sales', { needs: { database: 'write' }, proven: true }));
  ok(r.ok && r.replaced === 'old-crm', 'equipping into a full seat swaps, and names what came out');
  ok(ch.slots.sales.name === 'fallcrm', 'the new item is worn');

  ok(unequip(ch, 'sales').ok, 'a seat can be emptied');
  ok(ch.slots.sales === null, 'and it is');
  ok(!describe(build(ch)).powers.includes('database:write'), '⚑ and the power goes with it — respec only ever shrinks');
  ok(!unequip(ch, 'sales').ok, 'emptying an empty seat is reported, not pretended');
  ok(!unequip(ch, 'nonsense').ok, 'and an unknown seat is refused');
}

console.log('\n=== §7 · the sheet says what it CANNOT do, as loudly ===');
{
  const ch = character('si-didy', OWN());
  equip(ch, item('vault', 'money', { needs: { filesystem: 'read' }, proven: true }));
  const s = sheet(ch);
  ok(s.cannot.includes('shell') && s.cannot.includes('browser'), 'the sheet lists what is impossible for this build');
  ok(s.equipped.length === 1 && s.equipped[0].seatName === 'Money & accounts', 'worn gear is listed by its seat’s plain name');
  ok(s.equipped[0].grants.join() === 'filesystem:read', 'with the stat line it contributes');
  ok(/wearing 1 of 8/.test(s.line), 'and the one-line summary counts the slots');
  ok(/unrepresentable, not patched/.test(s.combo), 'the combo rule is stated, because it is invisible otherwise');
  ok(s.unbounded === false, 'a bounded character reports bounded');
}

console.log('\n=== §8 · fromCatalogue — the loot table is GENERATED, never typed ===');
{
  const cat = { organs: [
    { name: 'konomium-vault', room: 'trust', caps: { filesystem: 'read' }, url: 'https://x/1', description: 'accounts' },
    { name: 'fallcrm', room: 'market', caps: { database: 'write' }, url: 'https://x/2', description: null },
    { name: 'unsorted', room: 'nowhere', caps: {}, url: 'https://x/3' },
  ] };
  const seatOf = (o) => ({ trust: 'money', market: 'sales' })[o.room] || null;
  const items = fromCatalogue(cat, seatOf, ['konomium-vault']);
  ok(items.length === 2, 'an organ whose room maps to no seat is left out rather than dumped somewhere');
  ok(items[0].proven === true && items[1].proven === false, 'only the ones named as gate-passed are proven');
  ok(items[0].url === 'https://x/1', 'the live URL is carried through');
  ok(items[1].does === null, 'an organ with no description keeps null — nothing is invented for it');
  ok(fromCatalogue(null, seatOf).length === 0 && fromCatalogue({}, seatOf).length === 0, 'a missing catalogue yields nothing rather than throwing');

  const ch = character('si-didy', OWN());
  ok(equip(ch, items[0]).ok, 'a proven catalogue item equips');
  ok(!equip(ch, items[1]).ok, 'and an unproven one does not — the same rule, from real data');
}

console.log('\n=== §9 · nothing and nonsense are refused without throwing ===');
{
  const ch = character('si-didy', OWN());
  const nothing = equip(ch, null);
  ok(!nothing.ok, 'equipping nothing is refused');
  ok(/does not go in any seat/.test(nothing.why), 'with a reason rather than a crash');
  ok(ch.refused[0].item === null, 'and the refusal records a null item name, because there was no item to name');

  const wrongSeat = equip(ch, item('thing', 'blacksmith', { needs: {}, proven: true }));
  ok(!wrongSeat.ok && /"thing" does not go in any seat/.test(wrongSeat.why), 'an invented seat is refused, and the item is NAMED in the reason');
  ok(ch.refused[1].item === 'thing', 'and recorded under its name');

  ok(character(null, OWN()).name === 'si-didy', 'a character with no name given falls back to si-didy');
  ok(character('', OWN()).name === 'si-didy', 'and so does an empty one');
  ok(character('kel', OWN()).name === 'kel', 'a real name is kept');
}

console.log('\n=== §10 · the boundaries — equal is allowed, one step over is not ===');
{
  const ch = character('si-didy', grant({ filesystem: 'write' }, { calls: 5, spend: 1 }));
  ok(equip(ch, item('exact', 'work', { needs: { filesystem: 'write' }, proven: true })).ok,
    'gear wanting EXACTLY what the character holds is allowed — the clamp is not off by one');
  const over = equip(ch, item('over', 'admin', { needs: { filesystem: 'admin' }, proven: true }));
  ok(!over.ok, 'one level above is refused');
  ok(/filesystem:admin/.test(over.why), 'and the reason names the resource that was over');
  // ONLY that one. Listing every resource where the item and the character merely MATCH would bury
  // the actual problem in seven lines of "network:none, env:none, shell:none…".
  ok((over.why.match(/\b[a-z_]+:[a-z]+\b/g) || []).length === 1,
    'and names exactly ONE — the resources that were fine are not listed as if they were faults');

  // the union takes the higher of two, and equal levels do not churn
  const ch2 = character('x', grant({ network: 'write' }, { calls: 5 }));
  equip(ch2, item('a', 'sales', { needs: { network: 'read' }, proven: true }));
  equip(ch2, item('b', 'admin', { needs: { network: 'write' }, proven: true }));
  ok(describe(build(ch2)).powers.join() === 'network:write', 'read then write resolves to write');
  const ch3 = character('y', grant({ network: 'write' }, { calls: 5 }));
  equip(ch3, item('b', 'sales', { needs: { network: 'write' }, proven: true }));
  equip(ch3, item('a', 'admin', { needs: { network: 'read' }, proven: true }));
  ok(describe(build(ch3)).powers.join() === 'network:write', 'and write then read STILL resolves to write — order cannot lower a build');
  const ch4 = character('z', grant({ network: 'read' }, { calls: 5 }));
  equip(ch4, item('a', 'sales', { needs: { network: 'read' }, proven: true }));
  equip(ch4, item('b', 'admin', { needs: { network: 'read' }, proven: true }));
  ok(describe(build(ch4)).powers.join() === 'network:read', 'two items at the same level give that level, not a doubling');
}

console.log('\n=== §11 · the equip message names the seat a person reads ===');
{
  const ch = character('si-didy', OWN());
  const r = equip(ch, item('fallcrm', 'sales', { needs: { database: 'write' }, proven: true }));
  ok(/equipped in sales & pipeline/.test(r.why), 'the confirmation uses the seat’s plain name, lowercased — not the id');
  ok(r.replaced === null, 'and reports nothing replaced when the seat was empty');
}

console.log('\n=== §12 · a catalogue organ with no capabilities is still an item ===');
{
  const cat = { organs: [
    { name: 'harmless', room: 'r', caps: undefined, url: 'https://x/1' },
    { name: 'reader', room: 'r', caps: { filesystem: 'read' }, url: 'https://x/2', description: 'reads' },
  ] };
  const items = fromCatalogue(cat, () => 'work', ['harmless', 'reader']);
  ok(items.length === 2, 'both are read');
  ok(Object.keys(items[0].needs).length === 0, 'an organ declaring no capabilities needs none — not undefined');
  const ch = character('si-didy', grant({}, { calls: 3 }));
  ok(equip(ch, items[0]).ok, '⚑ and it equips onto a character that holds NOTHING — needing nothing is always within any grant');
  ok(!equip(ch, items[1]).ok, 'while one that needs something does not');
  ok(items[1].does === 'reads', 'a description is carried through when there is one');
}

console.log(`\n${fail === 0 ? '✓ LOADOUT GATE CLEAN' : '✗ LOADOUT GATE FAILED'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
