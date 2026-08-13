// episodes.mjs — TURN SESSIONS INTO SOMETHING THE DREAM CYCLE CAN ACTUALLY EAT.
//
// The dream log read `merged 0 · transitive 0 · generalized 0` and it was not broken. `dreamer.ingest`
// takes STRUCTURED triples — `{s, p, o}` — and skips anything without one (`if (!e.triple) continue`).
// It never parses prose. So feeding it 555 raw turns would store 555 episodes and still form zero
// facts. The missing piece was never the material; it was the step that turns material into relations.
//
// ⚑ AND THE ONLY RELATION A TRANSCRIPT HONESTLY ASSERTS IS CO-OCCURRENCE. Simon saying "wishwood" and
// "nobeds" in one breath is evidence they belong together. It is NOT evidence of what the relationship
// IS, and inventing a predicate for it — "wishwood USES nobeds" — would be fabrication dressed as
// learning. So the predicate is `related`, which is the honest claim, and it happens to be TRANSITIVE
// in the dreamer's vocabulary, so closure over it does real work: mentioned-with-mentioned-with gives
// you a path you never stated.
//
// The second relation is `status`, which is FUNCTIONAL — one value per subject, so contradictions
// resolve by evidence rather than piling up. A topic asked for across sessions is `recurring`.
//
// Pure: no I/O, no clock. The caller supplies the turns, the vocabulary and the day.

/**
 * The topic vocabulary is GROUNDED IN REAL NAMES — repos that exist — rather than any content word.
 * Ungrounded topics would fill the graph with "thing", "build", "proper" and the closure would connect
 * everything to everything, which is the same as connecting nothing.
 */
export function vocabulary(names) {
  const v = new Map();
  for (const raw of (Array.isArray(names) ? names : [])) {
    const n = String(raw || '').toLowerCase().trim();
    if (n.length < 4) continue;                       // two- and three-letter names collide with words
    v.set(n, n);
    // `fall-remember` is also written `fallremember`, and `si-didy` as `sididy`. The length is checked
    // AGAIN on the flattened form: `a-b-c` is five characters and flattens to three, and a three-letter
    // alias matches inside ordinary words.
    const flat = n.replace(/[-_]/g, '');
    if (flat === n) continue;
    if (flat.length < 4) continue;
    v.set(flat, n);
  }
  return v;
}

/** Which known topics does this text mention? Longest names first, so `fallkard-forge` beats `fallkard`. */
export function topicsIn(text, vocab) {
  const t = String(text || '').toLowerCase();
  if (!t || !(vocab instanceof Map)) return [];
  const found = new Set();
  for (const [alias, canonical] of vocab) {
    if (t.includes(alias)) found.add(canonical);
  }
  // Drop a topic wholly contained in a longer one that also matched — `fallkard` inside `fallkard-forge`
  // is one mention, not two, and counting it twice would invent a relation between a name and itself.
  const list = [...found].sort((a, b) => b.length - a.length);
  const kept = [];
  for (const n of list) if (!kept.some(k => k.includes(n))) kept.push(n);
  return kept.sort();
}

/**
 * The episodes a run of turns yields, in the shape `dreamer.ingest` wants.
 *
 * ⚑ CO-OCCURRENCE IS CAPPED PER TURN. A turn naming eight topics would emit 28 pairs and drown the
 * graph in one sentence's worth of evidence. Above the cap the turn is recorded as episodes without
 * triples — still remembered, just not asserted as relations.
 */
export function episodesFrom(turns, vocab, { day = 1, maxTopicsPerTurn = 5 } = {}) {
  const list = (Array.isArray(turns) ? turns : []).filter(t => t && t.text);
  const out = [];

  for (const t of list) {
    const topics = topicsIn(t.text, vocab);
    const text = String(t.text).slice(0, 200);

    if (topics.length < 2 || topics.length > maxTopicsPerTurn) {
      // Remembered, but asserting nothing. A single topic relates to nothing; too many relate to noise.
      if (topics.length === 1) out.push({ s: topics[0], text, day, conf: 1 });
      continue;
    }
    // Every unordered pair, written without index arithmetic — an off-by-one in a nested index loop is
    // invisible to a gate because the extra iteration produces nothing, which makes it exactly the kind
    // of line that survives mutation while looking correct.
    for (const [i, a] of topics.entries()) {
      for (const b of topics.slice(i + 1)) out.push({ s: a, p: 'related', o: b, conf: 1, day, text });
    }
  }
  return out;
}

/**
 * Recurring asks become a FUNCTIONAL status on their topics.
 *
 * Only things asked across more than one session qualify — the same distinction the digest already
 * draws, carried through so the graph inherits it rather than re-deciding it.
 */
export function statusFrom(recurring, vocab, { day = 1, minSessions = 2 } = {}) {
  const out = [];
  for (const r of (Array.isArray(recurring) ? recurring : [])) {
    if (!r || (r.sessions || 0) < minSessions) continue;
    for (const topic of topicsIn(r.example || r.gist || '', vocab)) {
      out.push({ s: topic, p: 'status', o: 'recurring', conf: 1, day, text: `asked across ${r.sessions} sessions: ${String(r.example || '').slice(0, 120)}` });
    }
  }
  return out;
}

/** Everything a session digest contributes, ready for `ingest(store, …)`. */
export function fromDigest(digest, vocab, { day = 1 } = {}) {
  const d = (digest && typeof digest === 'object') ? digest : {};
  const eps = [
    ...episodesFrom(d.corrections || [], vocab, { day }),
    ...episodesFrom(d.standing || [], vocab, { day }),
    ...statusFrom(d.recurring || [], vocab, { day }),
  ];
  const subjects = new Set(eps.map(e => e.s).filter(Boolean));
  return {
    episodes: eps,
    subjects: subjects.size,
    triples: eps.filter(e => e.p).length,
    // Said plainly, because the whole risk here is a graph that looks like knowledge and is a word count.
    bound: 'Relations are CO-OCCURRENCE — that these were named together, not what the relationship is. '
         + 'Closure over `related` finds paths nobody stated; it does not know what those paths mean.',
  };
}

export default { vocabulary, topicsIn, episodesFrom, statusFrom, fromDigest };
