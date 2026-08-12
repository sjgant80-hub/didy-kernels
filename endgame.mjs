// endgame.mjs — SI-DIDY AT MAX, AND WHY THAT IS THE RIGHT THING TO BUILD FIRST.
//
// FALL WORLD is designed backwards from here. You do not design a game by building the tutorial and
// hoping an endgame appears; you design the hardest fight and the best-in-slot gear, and every earlier
// rung becomes the path to it. So this file is the ceiling: what a finished agent IS, stated exactly
// enough that everything below it can be derived rather than invented.
//
// ⚑ THE ONE RULE THAT MAKES THE WHOLE THING HONEST: THERE IS NO SETTER.
// `levelOf` takes EVIDENCE and returns a tier. Nothing in this module can award a tier, and nothing
// accepts a tier as input. That is [[earned]] as a data structure — you cannot CLAIM a level, only
// present what you did and have it read. A character sheet with a writable level field is a cosmetic,
// and the estate has enough of those.
//
// ⚑ AND THE SECOND: YOU CANNOT SKIP A RUNG. A gap at tier 3 caps you at 2 even if 9 holds. Levelling
// is the CONJUNCTION of everything below it, not the maximum of what happens to be true. Otherwise an
// agent that has never been bounded but once shook hands with a peer reads as near-max, which is
// exactly the lie a star-count marketplace tells.
import { SEATS, isSeat } from './loadout.mjs';

// ── THE LADDER ───────────────────────────────────────────────────────────────────────────────────
//
// Ten rungs. Each is a real capability with a real check, and each is strictly harder to fake than
// the one below — which is the property that makes a ladder mean anything. The first four you can
// establish alone. From 5 a machine has to agree with you. From 7 a STRANGER has to, and that is the
// break-point the whole estate is built around: everything up to 6 is self-administered.

export const TIERS = [
  { n: 1,  id: 'awake',     name: 'Awake',      alone: true,
    is: 'it runs, and it can say what it is',
    holds: (e) => !!e.running && Array.isArray(e.organs) && e.organs.length > 0 },

  { n: 2,  id: 'bounded',   name: 'Bounded',    alone: true,
    is: 'it runs under a grant it cannot exceed and a budget it cannot outspend',
    holds: (e) => !!e.purse && e.purse.bounded === true },

  { n: 3,  id: 'named',     name: 'Named',      alone: true,
    is: 'it has an identity it can prove, not a name it asserts',
    holds: (e) => !!e.face && typeof e.face.id === 'string' && e.face.id.length > 0 && e.face.signed === true },

  { n: 4,  id: 'reading',   name: 'Reading',    alone: true,
    is: 'it reads a skill before trusting it, and refuses rather than warns',
    holds: (e) => !!e.inspector && e.inspector.refuses === true },

  { n: 5,  id: 'gated',     name: 'Gated',      alone: false,
    is: 'its own kernels survive a mutation gate — a machine tried to break them and failed',
    holds: (e) => !!e.gate && e.gate.killed > 0 && e.gate.unexplained === 0 },

  { n: 6,  id: 'geared',    name: 'Geared',     alone: false,
    is: 'every seat is filled with gear that was ADMITTED by inspection, never self-declared',
    holds: (e) => !!e.gear && e.gear.filled === SEATS.length && e.gear.selfDeclared === 0 },

  { n: 7,  id: 'met',       name: 'Met',        alone: false,
    is: 'it completed a trustless handshake — four results, neither side taking the other on trust',
    holds: (e) => cleared(e, 'duo') },

  { n: 8,  id: 'wired',     name: 'Wired',      alone: false,
    is: 'it did that across a channel where a function cannot travel, so only results crossed',
    holds: (e) => cleared(e, 'wire') },

  { n: 9,  id: 'raided',    name: 'Raided',     alone: false,
    is: 'it cleared the room: peers with DIFFERENT gates, a liar present, and the gain survived closing',
    holds: (e) => cleared(e, 'pub') },

  { n: 10, id: 'sovereign', name: 'Sovereign',  alone: false,
    is: 'all of the above, and it can show a stranger the evidence without asking to be believed',
    holds: (e) => !!e.evidence && e.evidence.reproducible === true && e.evidence.selfGraded === false },
];

export const MAX = TIERS.length;

// ── THE RAIDS ────────────────────────────────────────────────────────────────────────────────────
//
// Four trials, hardest last, and the ordering is by ONE axis: how much of the verdict you control.
// Your own gate you run yourself. The handshake you run with someone who is also running it on you.
// The wire removes your ability to hand a peer the code that judges you. The room removes your
// ability to be the only one grading, and adds someone actively trying to be believed without doing
// the work. There is nothing harder available, because at that point you control none of the verdict.

export const RAIDS = [
  {
    id: 'solo', name: 'Your own gate', tier: 5, party: 1,
    what: 'a machine mutates your code and every mutant must die, or be baselined with a written reason',
    // A gate that killed nothing tested nothing. A survivor with no reason is an open wound.
    check: (r) => {
      if (!r) return no('no gate record');
      if (!(r.killed > 0)) return no('the gate killed nothing — a gate that kills nothing is not evidence, it is a green light');
      if (r.unexplained > 0) return no(`${r.unexplained} survivor(s) with no written reason — a survivor is a hole until someone explains why it is not`);
      return yes(`${r.killed} mutants killed, every survivor explained`);
    },
  },
  {
    id: 'duo', name: 'The handshake', tier: 7, party: 2,
    what: 'both sides run BOTH functions and compare four results — nobody is taken at their word',
    // Two results is trust. Four is verification. The distinction is the entire kernel.
    check: (r) => {
      if (!r) return no('no handshake record');
      if (r.results !== 4) return no(`${r.results} result(s) — two results means you believed them; only four is cross-running`);
      if (r.trustedFirst) return no('one side was taken on trust before checking, which makes the check decorative');
      return yes('four results, cross-run, neither side trusted first');
    },
  },
  {
    id: 'wire', name: 'The wire', tier: 8, party: 2,
    what: 'the same exchange across a channel that SERIALISES, so implementations stay home',
    // The bug this raid exists to catch: a loopback handshake comparing a function object with itself.
    check: (r) => {
      if (!r) return no('no wire record');
      if (!r.serialised) return no('the channel did not serialise — over a same-process channel you may be comparing a function with itself, which proves nothing');
      if (r.functionsCrossed) return no('a function crossed the wire — that is accepting executable code from a peer, which is the thing this refuses');
      if (!r.pointersOnly) return no('what crossed was not pointers — a peer must tell you WHERE it lives so you can gate it yourself');
      return yes('serialising channel, pointers only, no implementation travelled');
    },
  },
  {
    id: 'pub', name: 'The room', tier: 9, party: 3,
    what: 'three or more, different gates, a liar in the room, and every gain still yours after it closes',
    // ⚑ THE HARDEST THING AVAILABLE, and the reason is structural rather than a difficulty dial: it is
    // the only trial where you control none of the verdict. You cannot clear it alone and you cannot
    // clear it by being trusted. The liar is not flavour — a room that has never been lied to cannot
    // tell you whether the rule or the doorman was doing the work.
    check: (r) => {
      if (!r) return no('no room record');
      if (!(r.peers >= 3)) return no(`${r.peers || 0} peer(s) — two is a handshake; a room needs a third who can disagree with both`);
      if (!r.allVerified) return no('not every link was verified, and a request over an unverified link must be refused rather than warned about');
      if (!r.differentGates) return no('every peer ran the same gate — agreeing with a copy of yourself is not cross-verification');
      if (!r.liarPresent) return no('no liar was present — an untested rule and a working doorman look identical from inside');
      if (r.liarGained !== 0) return no(`the liar gained ${r.liarGained} — it offered exactly what was wanted and should have received nothing`);
      if (!(r.gained > 0)) return no('nothing was gained — a room you leave with what you came with proves the meeting, not the point of it');
      if (!r.keptAfterClosing) return no('the gain did not survive closing — if the room holds it, the room is a landlord');
      return yes(`${r.peers} peers, ${r.gained} gained and kept, the liar got nothing`);
    },
  },
];

const yes = (why) => ({ cleared: true, why });
const no = (why) => ({ cleared: false, why });

/** Has this raid been cleared, on the evidence given? Unknown raid ids are refused, never assumed. */
export function clearRaid(raidId, record) {
  const raid = RAIDS.find(r => r.id === raidId);
  if (!raid) return no(`no raid called "${raidId}"`);
  const out = raid.check(record);
  return { ...out, raid: raid.id, name: raid.name, party: raid.party };
}

// `e` is always the normalised object from levelOf, so guarding it again here would be dead defensive
// code — and dead defensive code is indistinguishable from a live check when you are reading it later.
function cleared(e, raidId) {
  return clearRaid(raidId, e.raids ? e.raids[raidId] : null).cleared === true;
}

// ── THE GEAR ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Maxed gear, counted honestly.
 *
 * ⚑ `selfDeclared` is the number that matters and it is why tier 6 exists as its own rung. An item is
 * admitted because something INSPECTED it, never because it arrived with `proven: true` attached. Gear
 * that certifies itself is the marketplace failure the registry was written against, and it is a hole
 * that opens the moment an endpoint takes that field from the caller.
 */
export function gearState(equipped = []) {
  const list = Array.isArray(equipped) ? equipped : [];
  const seats = new Set();
  let selfDeclared = 0;
  for (const it of list) {
    if (!it || !isSeat(it.seat)) continue;
    seats.add(it.seat);
    if (it.admittedBy !== 'inspection') selfDeclared++;
  }
  return {
    filled: seats.size, of: SEATS.length, selfDeclared,
    empty: SEATS.filter(s => !seats.has(s.id)).map(s => s.name),
  };
}

// ── THE SHEET ────────────────────────────────────────────────────────────────────────────────────

/**
 * Read the evidence and say what this character IS.
 *
 * Returns the highest tier for which every rung at or below it holds — and, when that is short of MAX,
 * names the single thing standing in the way. "You are 6, and 7 needs a stranger to have checked you"
 * is a build instruction. "You are 6" is a score.
 */
export function levelOf(evidence = {}) {
  // A default parameter does not fire on an explicit null, and null is exactly what a caller reading a
  // missing record hands you. Normalised here so every predicate below sees an object or nothing.
  //
  // ⚑ AND THE RESULT IS REPORTED. "0/10 because you have done nothing" and "0/10 because what you
  // handed me was not readable" are completely different situations for the person holding the sheet,
  // and a normaliser that silently swallows the second is how a broken feed reads as a poor character.
  const usable = evidence !== null && typeof evidence === 'object';
  const e = usable ? evidence : {};

  const held = TIERS.map(t => {
    let ok = false;
    try { ok = t.holds(e) === true; } catch { ok = false; }   // a throwing predicate is a NO, never a crash
    return { ...t, held: ok };
  });

  let tier = 0;
  for (const t of held) { if (!t.held) break; tier = t.n; }

  const blocking = held.find(t => t.n === tier + 1) || null;
  // Stated because it is the difference between a ladder and a scoreboard: things can be true above
  // you and still not count, and someone reading their own sheet deserves to know which are which.
  // Strictly above your level. The rung immediately above is by definition the one that failed, so it
  // can never be held anyway — excluding it explicitly would only imply that it could be.
  const skipped = held.filter(t => t.n > tier && t.held).map(t => t.name);

  return {
    tier, max: MAX, usable,
    name: tier === 0 ? 'Unproven' : TIERS[tier - 1].name,
    maxed: tier === MAX,
    rungs: held.map(t => ({ n: t.n, name: t.name, is: t.is, held: t.held, alone: t.alone })),
    blocking: blocking ? { n: blocking.n, name: blocking.name, needs: blocking.is } : null,
    trueButNotCounted: skipped,
    // The honest headline. It never says MAX unless every rung below holds.
    line: (tier === MAX
      ? `MAX (${MAX}/${MAX}) — Sovereign. Every rung holds, and the top four were judged by someone else.`
      : tier === 0
        ? `Unproven (0/${MAX}) — nothing has been shown yet, which is where every character starts.`
        : `${TIERS[tier - 1].name} (${tier}/${MAX}) — next is ${blocking ? blocking.name + ': ' + blocking.is : 'nothing'}.`)
      + (skipped.length ? ` ${skipped.length} higher rung(s) already true but not counted, because a rung below is missing.` : ''),
    // ⚑ The bound, carried in the output so it cannot be quietly dropped by whatever renders this.
    bound: 'Rungs 1–6 are self-administered: si-didy inspects si-didy with si-didy\'s own inspector. '
         + 'Only 7–10 involve a party that does not already agree with it. A sheet that did not say so '
         + 'would be presenting self-assessment and peer-verification as the same kind of evidence.',
  };
}

/** The full endgame sheet: level, raids, gear, and what is left. */
export function endgame(evidence = {}) {
  const lvl = levelOf(evidence);
  const e = lvl.usable ? evidence : {};
  const raids = RAIDS.map(r => {
    const rec = e.raids ? e.raids[r.id] : null;
    const c = clearRaid(r.id, rec);
    return { id: r.id, name: r.name, party: r.party, what: r.what, cleared: c.cleared, why: c.why };
  });
  return {
    ...lvl,
    raids,
    hardest: raids[raids.length - 1],
    remaining: lvl.rungs.filter(r => !r.held).map(r => `${r.n} · ${r.name} — ${r.is}`),
  };
}

export default { TIERS, MAX, RAIDS, clearRaid, gearState, levelOf, endgame };
