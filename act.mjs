// act.mjs — TURN THE WISP'S VERDICT INTO SOMETHING TO DO.
//
// The wisp has been reporting 31 orbit folds — repos touched inside the window that leave nothing
// anyone else can run — and nothing consumed it. A diagnostic nobody acts on is a diagnostic that
// costs the same as being wrong. This is the consumer.
//
// ⚑ MEASURED BEATS INFERRED, AND THE DIFFERENCE IS LABELLED. An ORBIT is a fact: you touched this
// repo, and it serves no page. A SHADOW is an inference: you circled this idea and did not commit.
// Both belong on an agenda, but a reader must never have to guess which kind of claim a row is —
// ranking them into one undifferentiated list is how a measurement gets diluted into a hunch.
//
// ⚑ AND THE HONEST BOUND TRAVELS WITH IT. "Orbit" means NO LIVE PAGE. It does not mean unused,
// unfinished, or bad — the wisp's own note says external usage cannot be read from repo metadata, and
// that gap does not close just because the finding got turned into a task.
//
// Pure: no I/O, no clock. The caller supplies the nodes, the shadows and the date.

// ⚑ AN EXEMPTION NEEDS A WRITTEN REASON, EXACTLY LIKE A BASELINED MUTANT.
//
// The agenda measures "no live page" and cannot tell a build that should have one from a repo that
// should not — a private room, somebody else's fork, a data companion. Without a way to say so the
// list either nags forever or gets ignored, and an ignored list is worse than no list.
//
// So a repo may be excused, and the excuse is a SENTENCE. A bare name with no reason is refused and
// stays on the list: removing a row without saying why is how a backlog quietly becomes a lie about
// itself. Short reasons are refused for the same cause a two-word baseline would be.
export const MIN_REASON = 20;

export function exemptionOf(exempt, name) {
  const table = (exempt && typeof exempt === 'object') ? exempt : {};
  const raw = table[name];
  const why = typeof raw === 'string' ? raw.trim() : '';
  if (why.length < MIN_REASON) return null;        // an excuse is not a reason
  return why;
}

/**
 * The orbiting folds: hot (touched inside the window) but not live (serving nothing), minus anything
 * carrying a written exemption.
 */
export function orbits(nodes, exempt) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(n => n && n.hot && !n.live && !exemptionOf(exempt, n.name))
    .sort((a, b) => String(b.pushed || '').localeCompare(String(a.pushed || '')) || String(a.name).localeCompare(String(b.name)));
}

// ⚑ THREE REPOS THAT WERE ONE DECISION ARE ONE ROW.
//
// The estate mints companions systematically: <thing>-api, <thing>-mcp, <thing>-sdk, and a second
// family of <vertical>onboard / paper / practice. fallworld has always collapsed these; the agenda
// did not, so a single afternoon of scaffolding read as 123 separate things to do and buried the one
// real item under it. A count that is three times the number of decisions is not a backlog, it is a
// broken measure — and acting on it would mean farming pages for stubs, which is the exact thing the
// estate exists to refuse.
//
// It is a COLLAPSE, NOT A HIDE. The row carries every member name and the repo count stays reported
// alongside the row count, so nothing vanishes and the two numbers can never be confused.
const TAILS = ['onboard', 'paper', 'practice'];

export function familyOf(name) {
  const s = String(name == null ? '' : name);
  const m = /^(.+)-(api|mcp|sdk)$/.exec(s);
  if (m) return { base: m[1], part: m[2] };
  for (const tail of TAILS) {
    // Strictly longer, or "paper" itself would collapse into an empty base and swallow unrelated repos.
    if (s.length > tail.length && s.endsWith(tail)) return { base: s.slice(0, -tail.length), part: tail };
  }
  return null;
}

/**
 * Group a list of orbiting nodes into families. A base with only ONE member present is left alone:
 * a lone repo is not a family, and renaming it to a family nobody can point at would be a worse
 * answer than the one it replaced. Input order is preserved, so newest-first stays newest-first.
 */
export function collapse(list) {
  const items = (Array.isArray(list) ? list : []).filter(n => n && n.name != null);
  const byBase = new Map();
  for (const n of items) {
    const f = familyOf(n.name);
    if (!f) continue;
    if (!byBase.has(f.base)) byBase.set(f.base, []);
    byBase.get(f.base).push({ node: n, part: f.part });
  }

  const baseOf = new Map();
  for (const [base, members] of byBase) {
    if (members.length < 2) continue;
    for (const m of members) baseOf.set(m.node.name, base);
  }

  const rows = [], seen = new Set();
  for (const n of items) {
    const base = baseOf.get(n.name);
    if (base == null) {
      rows.push({ name: String(n.name), pushed: n.pushed || null, members: [String(n.name)], parts: [] });
      continue;
    }
    if (seen.has(base)) continue;
    seen.add(base);
    const group = byBase.get(base);
    rows.push({
      name: base,
      // The family was last touched when its most recent member was.
      pushed: group.map(m => m.node.pushed).filter(Boolean).sort().pop() || null,
      members: group.map(m => String(m.node.name)).sort(),
      parts: group.map(m => m.part).sort(),
    });
  }
  return rows;
}

/** What was excused, and why — kept visible, so an exemption is a decision on the record. */
export function excused(nodes, exempt) {
  const out = [];
  for (const n of (Array.isArray(nodes) ? nodes : [])) {
    if (!n || !n.hot || n.live) continue;
    const why = exemptionOf(exempt, n.name);
    if (why) out.push({ what: n.name, why });
  }
  return out.sort((a, b) => String(a.what).localeCompare(String(b.what)));
}

/**
 * What closes it. Deliberately ONE sentence per kind, and deliberately concrete — "improve fall-os"
 * is not an action, "give it a page somebody can open" is.
 */
const CLOSES = {
  orbit: 'ship a page anyone can open — that is the whole difference between a fold and a repo',
  // A family is deliberately NOT "ship three pages". Scaffolding minted in a batch is one decision,
  // and the honest close is to decide about the family: give it one page, or excuse it with a reason.
  family: 'decide about the family as a whole — one page for the set, or one written reason it should not have one',
  shadow: 'commit it or write down why not, so it stops costing a decision every time it comes round',
};

/**
 * The agenda.
 *
 * Orbits first, most recently touched first — because the thing you were working on YESTERDAY that
 * still serves nothing is the cheapest one to finish. Shadows after, and marked as inference.
 */
export function agenda(nodes, shadowList = [], opts) {
  // A default parameter does not fire on an explicit null, and null is exactly what a caller reading a
  // missing config hands you. Third time this pattern has bitten in this codebase — normalise, then
  // destructure.
  const { limit = 10, minCircled = 2, exempt = {} } = (opts && typeof opts === 'object') ? opts : {};
  const orb = orbits(nodes, exempt);
  const off = excused(nodes, exempt);
  const shadows = (Array.isArray(shadowList) ? shadowList : [])
    .filter(s => s && (s.times_shadowed || 0) >= minCircled)
    // The filter above already guarantees a real number, so the fallback guards here were dead code — and a dead
    // guard is indistinguishable from a live one when you read it later.
    .sort((a, b) => b.times_shadowed - a.times_shadowed);

  const fam = collapse(orb);

  const rows = [];
  for (const f of fam) {
    rows.push({
      kind: 'orbit', evidence: 'measured',
      what: f.name,
      // Every member named on the row. A collapsed count with no way to see what went into it is the
      // same failure as an exemption with no reason.
      members: f.members,
      why: f.members.length > 1
        ? `${f.members.length} repos of one family (${f.parts.join('/')}) — last touched ${f.pushed || 'recently'}, and not one of them serves a page`
        : `touched ${f.pushed || 'recently'} and serves no page`,
      closes: f.members.length > 1 ? CLOSES.family : CLOSES.orbit,
    });
  }
  for (const s of shadows) {
    rows.push({
      kind: 'shadow', evidence: 'inferred',
      what: String(s.branch || s.id || '').slice(0, 80),
      why: `circled in ${s.times_shadowed} separate decisions and never taken`,
      closes: CLOSES.shadow,
    });
  }

  const shown = rows.slice(0, limit);
  return {
    agenda: shown,
    // ⚑ TWO NUMBERS, BOTH NAMED. `orbits` stays the count of REPOS, so every existing reader keeps
    // meaning what it meant. `orbitRows` is the count of DECISIONS after families collapse. Quietly
    // redefining the first would have been the worse fix: a number that changes meaning is harder to
    // catch than one that is missing.
    orbits: orb.length, orbitRows: fam.length, shadows: shadows.length,
    // Excused rows are COUNTED and their reasons returned. A backlog that silently shrank is
    // indistinguishable from one that got finished, and only one of those is worth anything.
    excused: off.length, excusedRows: off,
    // ⚑ Said when it happens, because "10 things to do" reads identically whether it is all of them
    // or the first ten of ninety, and only one of those is a finishable list.
    // Math.max rather than a comparison: the ternary's two arms both yield 0 when the lengths are
    // equal, so the boundary could not be made to fail and the line was untestable by construction.
    truncated: Math.max(0, rows.length - shown.length),
    line: orb.length || shadows.length
      ? `${orb.length} measured (touched, serves nothing)`
        + (fam.length < orb.length ? ` in ${fam.length} families` : '')
        + ` · ${shadows.length} inferred (circled, not taken)`
        + (off.length ? ` · ${off.length} excused with a written reason` : '')
        + (rows.length > shown.length ? ` · showing ${shown.length} of ${rows.length}` : '')
      : `nothing measured and nothing circled — the frontier is either finished or not moving`
        + (off.length ? ` (${off.length} excused)` : ''),
    bound: 'ORBIT means no live page. It does NOT mean unused, unfinished or bad: whether anyone runs '
         + 'a thing cannot be read from repo metadata, and turning the finding into a task does not '
         + 'close that gap.',
  };
}

export default { orbits, agenda, collapse, familyOf, excused, exemptionOf };
