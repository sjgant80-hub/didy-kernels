// episodes.test.mjs — PROOF-OF-PLAY for turning sessions into relations.
//
// This is the step where a memory can start lying to itself. It converts loose human sentences into
// a graph, and a graph LOOKS like knowledge — so the tests are aimed at the two ways it becomes a word
// count wearing a knowledge costume: topics that were never real, and relations nobody asserted.
import { vocabulary, topicsIn, episodesFrom, statusFrom, fromDigest } from './episodes.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

const V = vocabulary(['wishwood', 'nobeds', 'fallkard', 'fallkard-forge', 'witness', 'si-didy', 'agora', 'os']);
const t = (text) => ({ text });

console.log('\n=== §1 · ⚑ TOPICS ARE GROUNDED IN REAL NAMES ===');
{
  ok(topicsIn('link wishwood to nobeds', V).join(',') === 'nobeds,wishwood', 'two known names are found');
  ok(topicsIn('build the proper thing now', V).length === 0,
     '⚑ ordinary words are NOT topics — an ungrounded vocabulary connects everything to everything');
  ok(topicsIn('', V).length === 0 && topicsIn('x', null).length === 0, 'empty text and a missing vocabulary find nothing');
  ok(!vocabulary(['os', 'ai', 'hr']).size, '⚑ names under four characters are refused — they collide with ordinary words');
  ok(vocabulary(['si-didy']).has('sididy'), 'a hyphenated name is also matched written flat');
  ok(topicsIn('run sididy tonight', V)[0] === 'si-didy', 'and resolves back to its canonical form');
}

console.log('\n=== §2 · ⚑ A NAME INSIDE A LONGER NAME IS ONE MENTION ===');
{
  const found = topicsIn('the fallkard-forge png', V);
  ok(found.length === 1 && found[0] === 'fallkard-forge',
     '⚑ "fallkard" inside "fallkard-forge" is not a second topic — counting it would relate a name to itself');
  ok(topicsIn('fallkard and fallkard-forge', V).length === 1, 'even when both are written out');
  ok(topicsIn('wishwood and fallkard-forge', V).length === 2, 'while two genuinely different names are two');
}

console.log('\n=== §3 · ⚑ THE RELATION IS CO-OCCURRENCE, AND NOTHING STRONGER ===');
{
  const eps = episodesFrom([t('hook wishwood up to nobeds')], V);
  ok(eps.length === 1, 'two topics in one turn make one relation');
  ok(eps[0].p === 'related', '⚑ the predicate is `related` — a transcript cannot tell you WHAT the relationship is');
  ok(eps[0].s === 'nobeds' && eps[0].o === 'wishwood', 'with the pair recorded in a stable order');
  ok(eps[0].text.includes('wishwood'), 'and the sentence it came from carried along as provenance');

  const three = episodesFrom([t('wishwood nobeds fallkard')], V);
  ok(three.length === 3, 'three topics make three pairs');
  ok(fromDigest({}, V).bound.includes('CO-OCCURRENCE'), 'and the bound is stated in the output, not left to the reader');
}

console.log('\n=== §4 · ⚑ ONE SENTENCE CANNOT FLOOD THE GRAPH ===');
{
  const many = episodesFrom([t('wishwood nobeds fallkard witness si-didy agora')], V, { maxTopicsPerTurn: 5 });
  ok(many.length === 0, '⚑ a turn naming six topics asserts nothing — 15 pairs from one sentence is noise, not evidence');
  const five = episodesFrom([t('wishwood nobeds fallkard witness agora')], V, { maxTopicsPerTurn: 5 });
  ok(five.length === 10, 'five topics is still within the cap');

  const one = episodesFrom([t('just wishwood today')], V);
  ok(one.length === 1 && !one[0].p, '⚑ a single topic is REMEMBERED but asserts no relation — it relates to nothing');
  ok(one[0].s === 'wishwood', 'though the subject is kept so it exists in the graph');
  ok(episodesFrom([t('nothing known here')], V).length === 0, 'and a turn with no topics contributes nothing at all');
}

console.log('\n=== §5 · recurring becomes a functional status ===');
{
  const st = statusFrom([{ sessions: 3, example: 'send me the wishwood url every build' }], V);
  ok(st.length === 1 && st[0].p === 'status' && st[0].o === 'recurring', 'a 3-session ask marks its topic recurring');
  ok(/asked across 3 sessions/.test(st[0].text), 'with the evidence in the text');
  ok(statusFrom([{ sessions: 1, example: 'wishwood once' }], V).length === 0,
     '⚑ a single-session ask is NOT recurring — that distinction is the whole point of the digest');
  ok(statusFrom([{ sessions: 5, example: 'no known names here' }], V).length === 0, 'and an ungrounded ask marks nothing');
}

console.log('\n=== §6 · the whole digest, and what it reports ===');
{
  const d = {
    corrections: [t('wishwood and nobeds again')],
    standing: [t('always push fallkard')],
    recurring: [{ sessions: 2, example: 'the witness gate on wishwood' }],
  };
  const r = fromDigest(d, V);
  ok(r.episodes.length >= 3, 'all three sources contribute');
  ok(r.triples >= 2, 'and the triple count is reported');
  ok(r.subjects >= 2, 'along with how many distinct subjects');
  ok(r.episodes.some(e => e.p === 'related'), 'relations are present');
  ok(r.episodes.some(e => e.p === 'status'), 'and so is status');
  ok(fromDigest(null, V).episodes.length === 0, 'a missing digest yields nothing rather than throwing');
}

console.log('\n=== §8 · the boundaries the gate found ===');
{
  // Four characters is a name. Three is a fragment that matches inside ordinary words.
  ok(vocabulary(['kard']).has('kard'), '⚑ a FOUR-character name is kept — the boundary is < 4, not <= 4');
  ok(!vocabulary(['ark']).has('ark'), 'three is refused');

  // A hyphenated name can flatten SHORTER than its own length: `a-b-c` is 5 chars and flattens to 3.
  const short = vocabulary(['a-b-c']);
  ok(short.has('a-b-c'), 'the hyphenated form is kept');
  ok(!short.has('abc'), '⚑ but its 3-character flattened alias is NOT — it would match inside any word');
  const flat = vocabulary(['ka-rd']);
  ok(flat.has('kard'), 'while a flattened alias of exactly four characters IS kept');

  // statusFrom falls back to the gist when there is no example, and both feed the text.
  const byGist = statusFrom([{ sessions: 2, gist: 'wishwood nobeds' }], V);
  ok(byGist.length === 2, '⚑ with no example, the GIST is used — the fallback is real, not decoration');
  const withEx = statusFrom([{ sessions: 4, example: 'the wishwood thing again' }], V);
  ok(/the wishwood thing again/.test(withEx[0].text), 'and the example text is carried into the evidence, not dropped');

  // Every source of the digest must actually contribute.
  const only = fromDigest({ standing: [t('wishwood and nobeds')] }, V);
  ok(only.episodes.length === 1 && only.episodes[0].p === 'related',
     '⚑ the standing-rules source contributes on its own — an empty-array fallback would silently drop it');
  const onlyCorr = fromDigest({ corrections: [t('fallkard and witness')] }, V);
  ok(onlyCorr.episodes.length === 1, 'and so does corrections on its own');
}

console.log('\n=== §7 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, [null], [{ text: null }], [{ text: 7 }]];
  let threw = null;
  for (const j of junk) {
    try { vocabulary(j); topicsIn(j, V); episodesFrom(j, V); statusFrom(j, V); fromDigest(j, V); } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
    try { topicsIn('wishwood', j); episodesFrom([t('wishwood nobeds')], j); } catch (e) { threw = `vocab ${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
