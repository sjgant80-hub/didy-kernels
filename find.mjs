// find.mjs — ASK SI-DIDY TO FIND SOMETHING.
//
// The estate is 1,625 repos folded into ~600 things, and the honest problem is not that Simon forgets
// what he built — it is that a name is a terrible index. "the thing that stops double bookings" is how
// a person actually remembers a build; `glampos` is not.
//
// So this searches MEANING first (the embedded soul), falls back to plain text, and — the part that
// matters — reports WHY each hit came back and how confident it is, because a search that returns ten
// results with no reason is asking to be believed rather than checked.
//
// ⚑ AND IT SAYS WHEN IT FOUND NOTHING. A search that pads a weak answer with its ten least-bad rows
// is the single most common way a tool teaches you to stop trusting it. Below the floor, this returns
// nothing and says so.
// ⚑ NO IMPORTS, ON PURPOSE. This used to pull `recall` and `shadows` straight out of soul.mjs, which
// meant publishing the search meant publishing the soul — and the soul carries private material that
// is not going anywhere. The two functions it genuinely needs are now INJECTED, so this file is pure,
// standalone and safe to hand to anyone, while the thing that holds the private parts stays home.
//
// It also happens to be the better shape: a search that cannot be handed a different recall is a
// search you cannot test without building the whole body first.
export const ESTATE = 'estate';

// ⚑ TWO SCORES, TWO SCALES, TWO FLOORS. The word score is a fraction of query terms found (0–1). The
// recall score is a similarity on its own scale entirely. Comparing them against one number — which is
// what this did first — means a 0.33 word match and a 0.33 similarity are treated as the same claim,
// and they are not remotely the same claim.
export const WORD_FLOOR = 0.2;

// Calibrated against measured separation on the LIVE soul (1,396 folded estate records): real queries
// scored 11.7–25.3, deliberate nonsense topped out at 6.2. Eight sits in the gap with margin.
//
// ⚑ AND IT IS CORPUS-DEPENDENT, WHICH IS A REAL LIMIT AND NOT A DETAIL. The recall score is not
// normalised, so it scales with how much there is to recall from — the same floor over a four-record
// soul rejects everything. Discovered by testing against a small soul and watching the meaning pass go
// silent. So it is an INPUT with a calibrated default, not a constant pretending to be universal, and
// anything relying on it should calibrate against its own corpus the same way this was.
export const MEANING_FLOOR = 8;

const norm = (s) => String(s == null ? '' : s).toLowerCase();

// ⚑ STOPWORDS INFLATE EVERY SCORE. "the thing that stops double bookings" is six words, and four of
// them appear in almost every description in the estate — so an unrelated repo matching only "the"
// and "that" scored 0.33 and cleared the floor. Stripping them is the difference between ranking by
// what was asked and ranking by how many common words the query happened to contain.
const STOP = new Set(['the', 'that', 'this', 'and', 'for', 'with', 'from', 'you', 'your', 'its', 'was',
  'are', 'has', 'have', 'can', 'not', 'all', 'any', 'but', 'out', 'get', 'got', 'how', 'what', 'when',
  'where', 'who', 'which', 'thing', 'things', 'stuff', 'one', 'two', 'let', 'into', 'over', 'about']);

const words = (s) => (norm(s).match(/[a-z0-9][a-z0-9-]{1,}/g) || []);
const contentWords = (s) => words(s).filter(w => w.length > 2 && !STOP.has(w));

/**
 * Find things in the estate.
 *
 * Two passes, deliberately in this order:
 *   1. MEANING — the embedded recall, which is what makes "stops double bookings" find `glampos`.
 *   2. LITERAL — every word present somewhere, which catches exact names and rare jargon that
 *      embeddings smooth away.
 *
 * A hit found by both is stronger than a hit found by either, and that is said in the output rather
 * than folded into a single opaque score.
 */
export function find(soul, query, { k = 8, kind = ESTATE, liveOnly = false, meaningFloor = MEANING_FLOOR, recall = null } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return { query: q, hits: [], why: 'a search needs something to search for', searched: 0 };
  }

  const seen = new Map();
  const add = (rec, score, how) => {
    // Optional chaining rather than two separate guards: one operator instead of two, and no
    // unreachable branch for a gate to flag. The null-record arm was never reachable — both callers
    // hold a real record — and dead defensive code reads exactly like a live check later on.
    if (!rec?.meta) return;
    // Keyed on the canonical name because that IS the identity: two records folded under one canonical
    // are one thing seen twice. The former `|| rec.name` third fallback is gone — every record placed
    // by ingestEstate carries an id, so it could not fire, and an arm that cannot fire is noise.
    const key = rec.meta.canonical || rec.id;
    const cur = seen.get(key) || { rec, meaning: 0, words: 0, how: [] };
    if (how === 'meaning') cur.meaning = Math.max(cur.meaning, score);
    else cur.words = Math.max(cur.words, score);
    if (!cur.how.includes(how)) cur.how.push(how);
    seen.set(key, cur);
  };

  // 1 · meaning
  //
  // ⚑ AN ABSENT SCORE IS NOT A MIDDLING SCORE. `recall` always returns its nearest centre, even for
  // nonsense — so defaulting a missing score to 0.5 meant every query, however meaningless, came back
  // with a confident-looking hit. No score means no evidence, and no evidence does not clear a floor.
  // No recall supplied means the meaning pass simply does not run — the literal pass still does, and
  // the output labels every row by how it was found, so a caller can always see which passes spoke.
  let searched = 0;
  try {
    const r = typeof recall === 'function' ? recall(soul, q, { kind, k: Math.max(k * 3, 24) }) : null;
    if (!r) throw new Error('no recall');
    // ⚑ ROUNDED AT ADMISSION, so the number compared against the floor is the SAME number reported on
    // the row. While the raw score was compared and a rounded one displayed, no caller could reason
    // about the boundary — a hit shown as 8 might have been 7.996 and turned away, and the difference
    // was invisible. A similarity has no meaningful precision past two places anyway.
    const s = Math.round(Number(r.score) * 100) / 100;
    if (Number.isFinite(s) && s >= meaningFloor) {
      for (const m of (r.members || [])) add(m, s, 'meaning');
      if (r.center) add(r.center, s, 'meaning');
    }
  } catch { /* recall unavailable on this soul — the literal pass still runs */ }

  // 2 · literal
  //
  // One content word out of three is a coincidence, not a match. Corroboration is required unless the
  // query was a single word, in which case that word IS the whole query.
  const terms = contentWords(q);
  const needed = terms.length <= 1 ? 1 : 2;
  for (const chamber of soul.memory.chambers) {
    for (const rec of chamber) {
      if (!rec.meta || (kind && rec.meta.kind !== kind)) continue;
      searched++;
      if (!terms.length) continue;
      const hay = norm(rec.text) + ' ' + norm(rec.meta.canonical) + ' ' + norm((rec.meta.members || []).join(' '));
      const hit = terms.filter(t => hay.includes(t)).length;
      if (hit >= needed) add(rec, hit / terms.length, 'words');
    }
  }

  let hits = [...seen.values()]
    // The meaning pass already enforced the floor at admission, so re-testing the score here could
    // never fail — and with a floor of zero it did worse than nothing, admitting a words-only hit
    // whose word score was too weak, purely because zero cleared a floor of zero. What is actually
    // meant is: keep it if a pass vouched for it, or if the literal match is strong enough alone.
    .filter(h => h.how.includes('meaning') || h.words >= WORD_FLOOR)
    .filter(h => !liveOnly || (h.rec.meta.live > 0))
    // Corroboration first, then how much of the query literally appears. Written as ONE comparable
    // rather than a chain of `||` tiebreaks: a corroborated hit scores 2 for its two sources plus its
    // word fraction, so it always outranks a single-source hit however well that one matched, and
    // within a class the better word match wins. The meaning score is deliberately not a tiebreak here
    // — it already decided ENTRY at the floor, and its scale varies with the corpus, so ranking across
    // it would compare two numbers that do not mean the same thing.
    .sort((a, b) => strength(b) - strength(a))
    .slice(0, k)
    .map(h => shape(h));

  const corroborated = hits.filter(h => h.found === 'meaning AND words').length;
  return {
    query: q, searched, hits, corroborated,
    // ⚑ Nothing, said plainly, rather than the ten least-bad rows.
    why: !hits.length
      ? `nothing in the estate matched "${q}" above the floor. That is a real answer: either it was never built, or it was built under words nothing here shares.`
      : corroborated
        ? `${hits.length} of ${searched} searched · ${corroborated} found by BOTH meaning and words — those are the ones to trust first`
        : `${hits.length} of ${searched} searched, but NONE were corroborated — every row below was found one way only, so treat this as a weak result`,
  };
}

/** How strong a hit is: sources found it, plus how much of the query it literally contains. */
const strength = (h) => h.how.length * 2 + h.words;

function shape(h) {
  const m = h.rec.meta;
  return {
    name: m.canonical || h.rec.name,
    what: String(h.rec.text || '').slice(0, 180),
    url: m.url || null,
    live: (m.live || 0) > 0,
    alsoKnownAs: (m.members || []).filter(n => n !== m.canonical).slice(0, 6),
    sharing: Math.max(0, (m.count || 1) - 1),
    lastTouched: m.pushed || null,
    // Both scores, on their own scales, never blended into one number that hides which is which.
    meaning: Math.round(h.meaning * 100) / 100,
    words: Math.round(h.words * 100) / 100,
    // The reason, on every row. "Both" is the strong one and the reader should be able to see which.
    found: h.how.length > 1 ? 'meaning AND words' : h.how[0],
  };
}

/**
 * What did I nearly build? The shadow index, searched.
 *
 * Different question from `find`, and worth its own door: the shadows are the roads circled and not
 * taken, so this answers "have I thought about this before and dropped it" — which is exactly the
 * thing a person cannot remember and a machine trivially can.
 */
export function findShadow(soul, query, { shadows = null } = {}) {
  const terms = contentWords(query);
  // No reader supplied, or a soul that has never circled anything, both mean the same thing here: an
  // empty list and an honest answer, never a crash.
  let all = [];
  try { all = (typeof shadows === 'function' ? shadows(soul) : null) || []; } catch { all = []; }
  const hits = all
    .map(s => {
      const hay = norm(s.branch || s.id) + ' ' + norm((s.contexts || []).join(' '));
      const n = terms.filter(t => hay.includes(t)).length;
      return { branch: s.branch || s.id, times: s.times_shadowed || 1, contexts: s.contexts || [], score: terms.length ? n / terms.length : 0 };
    })
    .filter(h => h.score > 0)
    // Score only. The times ordering is ALREADY in the list — `shadows()` is `ranked()`, which sorts by
    // times_shadowed before this ever sees it — and Array.prototype.sort is required to be stable, so
    // re-asserting it here changed nothing and could not be made to fail. §11 pins the behaviour that
    // matters: the more-circled road is cast SECOND and still comes back first.
    .sort((a, b) => b.score - a.score);
  return {
    query: String(query || ''), considered: all.length, hits: hits.slice(0, 8),
    why: hits.length
      ? `${hits.length} road(s) you circled and did not take`
      : all.length
        ? `nothing among the ${all.length} roads-not-taken matches — this is not something you have circled before`
        : 'nothing has been circled and passed over yet',
  };
}

export default { find, findShadow, WORD_FLOOR, MEANING_FLOOR };
