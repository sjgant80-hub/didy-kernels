// loadout.mjs — SI-DIDY AS A CHARACTER SHEET.
//
// The recurse, folded: the last two passes were the BOUND (si-didy runs under a capability it cannot
// exceed and a budget it cannot outspend) and the WIRE (a function cannot cross it; what crosses is a
// pointer you gate yourself). This compounds both into the thing they were always for — equipping.
//
// ⚑ THE GAME VOCABULARY IS NOT DECORATION, IT IS THE SIMPLIFICATION. 1,621 repos is illegible to
// everyone, including the person who built them. "Armour, gems, potions, gold, levels" is vocabulary
// every human already holds. And it maps onto machinery that is already shipped and gated — which is
// why it is honest to use it: an item's STATS are its capability grant, its MANA COST is its budget,
// its ITEM LEVEL is whether it passed a gate, and RESPEC is attenuation.
//
// ⚑ THE COMBO RULE — and it is the security property wearing a game hat. A loadout's power is the
// UNION of its equipped gear, and never one point more than the character itself holds. Stack five
// organs that each want the shell and you still get whatever the character was granted. There is no
// stacking exploit, because `attenuate` makes one structurally impossible: a build can only ever
// shrink. In a game that is a balance patch nobody can complain about. Here it is the reason a
// runaway loadout cannot exist.
import { grant, describe, RESOURCES, rank } from './organs/capability.mjs';
import { attenuate, within } from './organs/capability.mjs';

/**
 * The eight seats. Named as a person would name the job, never as the repo names itself — the whole
 * point is that someone who has never read this code knows what a slot is for.
 */
export const SEATS = [
  { id: 'sales',   name: 'Sales & pipeline',    blurb: 'Finding work and keeping track of who wants what.' },
  { id: 'money',   name: 'Money & accounts',    blurb: 'Invoices, books, what came in and what went out.' },
  { id: 'legal',   name: 'Legal & compliance',  blurb: 'Letters, rights, and staying on the right side of the rules.' },
  { id: 'people',  name: 'People & hiring',     blurb: 'Who works with you, and proving they can do the job.' },
  { id: 'work',    name: 'The work itself',     blurb: 'The thing the business actually does for its customers.' },
  { id: 'admin',   name: 'Office & admin',      blurb: 'Notes, mail, minutes — the paperwork of a day.' },
  { id: 'brain',   name: 'The brain',           blurb: 'Which model thinks, and where it runs.' },
  { id: 'trust',   name: 'Proof & identity',    blurb: 'Signing what was done, and proving it later.' },
];
export const isSeat = (id) => SEATS.some(s => s.id === id);

/**
 * An item. `needs` is what it must be allowed to touch — its stat line — and `proven` is whether it
 * passed a gate.
 *
 * ⚑ UNPROVEN GEAR CANNOT BE EQUIPPED. Not warned about, not equipped-with-a-badge: refused. That is
 * the registry rule wearing an item-level, and it is the difference between a shop and a marketplace
 * with a 12% malware rate.
 */
export function item(name, seat, { needs = {}, proven = false, url = null, does = null } = {}) {
  const caps = {};
  for (const [r, lvl] of Object.entries(needs)) if (RESOURCES.includes(r)) caps[r] = lvl;
  return { name: String(name), seat: String(seat), needs: caps, proven: !!proven, url, does };
}

/** A fresh character: eight empty slots and the grant its owner gave it. */
export function character(name, own) {
  const slots = {};
  for (const s of SEATS) slots[s.id] = null;
  return { name: String(name || 'si-didy'), own, slots, refused: [] };
}

/**
 * Equip one item into its seat.
 *
 * Three refusals, each with its reason: a seat that does not exist, an item that has not passed a
 * gate, and an item that wants more than the character itself holds. The third is the interesting
 * one — it is not "you are too low level", it is "nothing can grant what the character was never
 * given", and it is enforced by the same clamp that governs delegation.
 */
export function equip(ch, it) {
  if (!it || !isSeat(it.seat)) {
    const why = `"${it && it.name}" does not go in any seat this character has`;
    ch.refused.push({ item: it && it.name, why });
    return { ok: false, why };
  }
  if (!it.proven) {
    const why = `${it.name} has not passed a gate — unproven gear cannot be equipped, only admired`;
    ch.refused.push({ item: it.name, why });
    return { ok: false, why };
  }
  const wants = grant(it.needs, {});
  if (!withinOwn(ch.own, wants)) {
    const over = RESOURCES.filter(r => rank(wants.caps[r]) > rank(ch.own.caps[r]));
    const why = `${it.name} wants ${over.map(r => r + ':' + wants.caps[r]).join(', ')} — more than this character holds`;
    ch.refused.push({ item: it.name, why });
    return { ok: false, why };
  }
  const swapped = ch.slots[it.seat];
  ch.slots[it.seat] = it;
  return { ok: true, why: `${it.name} equipped in ${SEATS.find(s => s.id === it.seat).name.toLowerCase()}`, replaced: swapped ? swapped.name : null };
}

// Capability-only containment: the budget is the character's and is not divided per item.
function withinOwn(own, wants) {
  for (const r of RESOURCES) if (rank(wants.caps[r]) > rank(own.caps[r])) return false;
  return true;
}

export function unequip(ch, seatId) {
  if (!isSeat(seatId)) return { ok: false, why: 'no such seat' };
  const was = ch.slots[seatId];
  ch.slots[seatId] = null;
  return { ok: !!was, why: was ? `${was.name} unequipped` : 'that seat was already empty' };
}

/**
 * THE BUILD: what this character can actually do, right now.
 *
 * The union of the equipped gear, clamped to what the character holds. `attenuate` does the clamping,
 * so the result cannot exceed the character's own grant however the items are combined — the stacking
 * exploit is unrepresentable rather than patched.
 */
export function build(ch) {
  const union = {};
  for (const s of SEATS) {
    const it = ch.slots[s.id];
    if (!it) continue;
    for (const [r, lvl] of Object.entries(it.needs)) {
      if (rank(lvl) > rank(union[r] || 'none')) union[r] = lvl;
    }
  }
  const g = attenuate(ch.own, union, {
    calls: ch.own.budget.calls, spend: ch.own.budget.spend,
  });
  return g;
}

/**
 * The character sheet, in words a person reads.
 *
 * What it CANNOT do is stated as prominently as what it can, because a loadout screen that only shows
 * powers teaches you nothing about what you just agreed to.
 */
export function sheet(ch) {
  const g = build(ch);
  const d = describe(g);
  const worn = SEATS.filter(s => ch.slots[s.id]).map(s => ({
    seat: s.id, seatName: s.name, item: ch.slots[s.id].name,
    grants: Object.entries(ch.slots[s.id].needs).map(([r, l]) => r + ':' + l),
    url: ch.slots[s.id].url,
  }));
  const empty = SEATS.filter(s => !ch.slots[s.id]).map(s => s.name);
  return {
    name: ch.name,
    equipped: worn, empty,
    can: d.powers, cannot: d.none,
    calls: d.calls, spend: d.spend, unbounded: d.unbounded,
    refused: ch.refused,
    // One sentence. If a person reads nothing else on the page, they read this.
    line: worn.length === 0
      ? `${ch.name} has nothing equipped — it can do nothing at all, which is where every character starts.`
      : `${ch.name} is wearing ${worn.length} of ${SEATS.length}, and may ${d.powers.length ? d.powers.map(p => p.split(':')[0]).join(', ') : 'do nothing'} — and nothing else.`,
    // Stated because it is the rule that makes combining safe, and it is invisible if nobody says it.
    combo: 'A build is the union of its gear, clamped to what the character holds. Stacking cannot exceed the grant — the exploit is unrepresentable, not patched.',
  };
}

/** Read a generated catalogue into items. Seats are assigned by the catalogue, never guessed here. */
export function fromCatalogue(cat, seatOf, provenNames = []) {
  const proven = new Set(provenNames);
  const out = [];
  for (const o of (cat && cat.organs) || []) {
    const seat = seatOf(o);
    if (!seat) continue;
    out.push(item(o.name, seat, { needs: o.caps || {}, proven: proven.has(o.name), url: o.url, does: o.description }));
  }
  return out;
}

export default { SEATS, isSeat, item, character, equip, unequip, build, sheet, fromCatalogue };
