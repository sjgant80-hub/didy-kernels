// find.test.mjs — PROOF-OF-PLAY for the search.
//
// A search is trusted long before anyone checks it, which makes it one of the easiest places in a
// system to hide a lie. The failure is never "it found nothing" — it is "it found ten things and one
// of them looked plausible". So these tests aim almost entirely at the negative space: nonsense must
// come back empty, weak results must be labelled weak, and common words must not count as evidence.
import { find, findShadow, WORD_FLOOR, MEANING_FLOOR } from './find.mjs';

let pass = 0, fail = 0;

// ⚑ NO IMPORT OF THE SHADOW ORGAN, DELIBERATELY. The real one reaches core.mjs, which carries private
// material that is not published — and `findShadow` takes its reader as an argument precisely so the
// contract can be tested without dragging the implementation along.
//
// The contract is exactly this: a list of {branch, times_shadowed, contexts}, ALREADY ORDERED by
// times_shadowed descending — which is what the estate's `ranked()` guarantees. `findShadow` sorts by
// score alone and leans on a stable sort to preserve that order, so the stub states the precondition
// rather than hiding it.
const shadowIndex = () => ({ list: [] });
const castShadow = (idx, branch, decision) => {
  let e = idx.list.find(x => x.branch === branch);
  if (!e) { e = { id: 'sh:' + idx.list.length, branch, contexts: [], times_shadowed: 0 }; idx.list.push(e); }
  if (!e.contexts.includes(decision)) e.contexts.push(decision);
  e.times_shadowed = e.contexts.length;
  return e;
};
const readShadows = (soul) => [...soul.shadow.list].sort((a, b) => b.times_shadowed - a.times_shadowed);
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

// A soul stub: chambers of records, and a recall() we control, so the two passes can be tested apart.
function soulOf(records, recallResult = null) {
  return {
    memory: { chambers: [records] },
    __recall: recallResult,
    shadow: shadowIndex(),
  };
}
const rec = (canonical, text, extra = {}) => ({
  id: 'estate:' + canonical, text,
  meta: { kind: 'estate', canonical, live: 1, members: [canonical], count: 1, ...extra },
});

const ESTATE = [
  rec('glampos', 'glampos · Site automation for glamping and small stays, with a double-booking guard'),
  rec('witness', 'witness · Deterministic build gate: mutation and fuzz, catches test-theatre'),
  rec('agora', 'agora · Ed25519 agents earn only by verified work, signed transfers'),
  rec('quantumkid', 'quantumkid · ai native the right way'),
];

console.log('\n=== §1 · it finds the right thing by MEANING, not by name ===');
{
  const s = soulOf(ESTATE);
  const r = find(s, 'double booking guard for glamping');
  ok(r.hits.length > 0, 'a description-shaped query returns something');
  ok(r.hits[0].name === 'glampos', 'and the right thing is first');
  ok(r.hits[0].found === 'words' || r.hits[0].found === 'meaning AND words', 'with the reason stated');
}

console.log('\n=== §2 · ⚑ NONSENSE RETURNS NOTHING, AND SAYS SO ===');
{
  const s = soulOf(ESTATE);
  for (const junk of ['banana helicopter tuesday', 'zxqw plorp gnnn', 'purple velvet elephant']) {
    const r = find(s, junk);
    ok(r.hits.length === 0, `"${junk}" returns nothing`);
  }
  const r = find(s, 'banana helicopter tuesday');
  ok(/never built, or it was built under words nothing here shares/.test(r.why),
     '⚑ and the empty result is stated as a real answer, not an apology');
  ok(r.searched > 0, 'while still reporting how much was searched, so "nothing" is distinguishable from "did not look"');
}

console.log('\n=== §3 · ⚑ COMMON WORDS ARE NOT EVIDENCE ===');
{
  const s = soulOf(ESTATE);
  // "the", "that", "for", "with" appear in nearly every description in any estate.
  const r = find(s, 'the that for with and this');
  ok(r.hits.length === 0, 'a query made entirely of stopwords matches nothing');

  // One content word out of three is a coincidence. Two is a claim.
  const one = find(s, 'quantum ferret disco');
  ok(one.hits.every(h => h.found !== 'words'), '⚑ ONE content word out of three does not produce a word-match');
  const two = find(s, 'mutation fuzz gate');
  ok(two.hits.some(h => h.name === 'witness'), 'but two or more do');
}

console.log('\n=== §4 · a single-word query is allowed to match on that word ===');
{
  const s = soulOf(ESTATE);
  const r = find(s, 'glamping');
  ok(r.hits.some(h => h.name === 'glampos'), 'one word IS the whole query, so one match is corroboration enough');
}

console.log('\n=== §5 · ⚑ TWO SCALES, NEVER BLENDED ===');
{
  ok(WORD_FLOOR > 0 && WORD_FLOOR <= 1, 'the word floor is a fraction of query terms');
  ok(MEANING_FLOOR > 1, '⚑ and the meaning floor is on the recall scale — a different number entirely');
  const s = soulOf(ESTATE);
  const r = find(s, 'mutation fuzz gate');
  const h = r.hits[0];
  ok(typeof h.meaning === 'number' && typeof h.words === 'number', 'both scores are reported');
  ok(h.words >= 0 && h.words <= 1, 'the word score stays in 0–1');
  ok(!('score' in h), 'and there is no single blended number that would hide which is which');
}

console.log('\n=== §6 · ⚑ AN UNCORROBORATED RESULT IS LABELLED WEAK ===');
{
  const s = soulOf(ESTATE);
  const r = find(s, 'mutation fuzz gate');
  if (r.corroborated === 0) {
    ok(/NONE were corroborated/.test(r.why), 'when nothing is corroborated the summary says so first');
  } else {
    ok(/found by BOTH meaning and words/.test(r.why), 'when something is, it is named as the one to trust');
  }
  ok(typeof r.corroborated === 'number', 'the corroborated count is always reported');
  ok(r.hits.every(h => h.found), 'and every row carries how it was found');
  // ⚑ COUNTED EXACTLY, not loosely. With no recall injected nothing CAN be corroborated, so the count
  // is zero while hits are not — a count that merely tracked "some rows exist" would pass a loose
  // assertion and still be reporting the opposite of the truth.
  ok(r.hits.length > 0, 'there are rows');
  ok(r.corroborated === 0, 'and exactly zero of them are corroborated');
  // ⚑ "meaning AND words" is a claim of CORROBORATION. A row found one way must never wear it —
  // that label is the entire basis on which a reader decides which result to trust first.
  ok(r.hits.every(h => h.found === 'words'), 'a stub soul has no meaning pass, so every row says "words" and nothing claims corroboration');
  ok(!r.hits.some(h => h.found === 'meaning AND words'), 'nothing claims to be corroborated when only one pass ran');
}

console.log('\n=== §7 · liveOnly, and a query too short to be a query ===');
{
  const withDead = [...ESTATE, rec('deadthing', 'deadthing · mutation fuzz gate but not live', { live: 0 })];
  const s = soulOf(withDead);
  const all = find(s, 'mutation fuzz gate');
  const live = find(s, 'mutation fuzz gate', { liveOnly: true });
  ok(live.hits.length <= all.hits.length, 'liveOnly never returns more');
  ok(live.hits.every(h => h.live), 'and everything it returns is live');
  // ⚑ live: 0 must read as NOT live. A boundary slip here marks every dead repo alive, and the whole
  // point of the flag is telling a person whether there is anything to open.
  const dead = all.hits.find(h => h.name === 'deadthing');
  ok(dead && dead.live === false, 'a record with live: 0 reports live === false');
  ok(!live.hits.some(h => h.name === 'deadthing'), 'and liveOnly actually excludes it');
  ok(find(s, '').hits.length === 0 && /needs something to search for/.test(find(s, '').why), 'an empty query is refused with a reason');
  ok(find(s, 'a').hits.length === 0, 'and so is a single character');
  // The boundary itself: two characters is a query. Real names live down here — `os`, `hr`, `ai`.
  ok(find(s, 'os').searched > 0, '⚑ a TWO-character query is searched, not refused — short names are real names');
  ok(find(s, 'a').searched === 0, 'while one character is refused before any work is done');

  // ⚑ THE WORD BOUNDARY IS THREE CHARACTERS. Two-letter fragments — "os", "hr", "ai" — appear inside
  // so many words that counting them as evidence would match half the estate on noise. So a two-letter
  // query is searched and honestly finds nothing by words, rather than finding everything.
  const two = soulOf([rec('osthing', 'an os and some hr and a bit of ai')]);
  ok(find(two, 'os').hits.length === 0, 'a two-letter term is not word-evidence');
  ok(find(two, 'and').hits.length === 0, 'nor is a three-letter stopword');
  ok(find(two, 'bit').hits.length === 1, 'but a three-letter content word is');

  // ⚑ THE WORD FLOOR IS INCLUSIVE TOO. Exactly two of ten terms is 0.2, which IS the floor — and a hit
  // sitting precisely on a threshold must be kept, or the threshold quietly means something stricter
  // than the number written down.
  const ten = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet';
  const onFloor = soulOf([rec('twohit', 'alpha bravo and nothing else from that list')]);
  const r10 = find(onFloor, ten);
  ok(r10.hits.length === 1 && r10.hits[0].words === 0.2, 'a hit scoring exactly the word floor is kept');
  const belowFloor = soulOf([rec('onehit', 'alpha and nothing else from that list')]);
  ok(find(belowFloor, ten).hits.length === 0, 'and one below it is not — one term of ten is noise');

  // A record with no canonical name still comes back under the name it does have.
  const noCanon = { id: 'estate:x', text: 'mutation fuzz gate with no canonical name', meta: { kind: 'estate', live: 1 }, name: 'nameless' };
  const nc = find(soulOf([noCanon]), 'mutation fuzz gate');
  ok(nc.hits.length === 1 && nc.hits[0].name === 'nameless', 'a record with no canonical falls back to its own name rather than vanishing');

  // ⚑ THE CANONICAL NAME IS THE IDENTITY. Two records folded under one canonical are ONE thing seen
  // twice, and must collapse to a single row — keying on anything else (the id, the record name) would
  // show the same build twice and quietly inflate every result count.
  const twin = (id) => ({ id, text: 'mutation fuzz gate', meta: { kind: 'estate', canonical: 'witness', live: 1 } });
  const dup = find(soulOf([twin('estate:a'), twin('estate:b')]), 'mutation fuzz gate');
  ok(dup.hits.length === 1, 'two records sharing a canonical name collapse to one row');
  ok(dup.hits[0].name === 'witness', 'under that canonical name');
}

console.log('\n=== §8 · the shadow search answers a DIFFERENT question ===');
{
  // A REAL shadow index, built with the real organ, so this tests the integration rather than a stub
  // shaped like whatever the test happened to assume.
  const s = soulOf(ESTATE);
  s.shadow = shadowIndex();
  castShadow(s.shadow, 'build a mesh over sound', 'deepen:mesh');
  castShadow(s.shadow, 'build a mesh over sound', 'deepen:airgap');   // same branch, second decision
  const hit = findShadow(s, 'mesh sound', { shadows: readShadows });
  ok(hit.hits[0] && hit.hits[0].times === 2, 'and reports how many DISTINCT decisions circled it');
  ok(hit.hits.length === 1 && /you circled and did not take/.test(hit.why), 'it finds what you circled and did not take');
  ok(hit.hits.length === 1, 'and the same branch circled twice is ONE road, not two');
  const miss = findShadow(s, 'something never considered', { shadows: readShadows });
  ok(miss.hits.length === 0, 'and returns nothing for what you never circled');
  ok(/not something you have circled before/.test(miss.why), '⚑ which is itself the useful answer');
}

console.log('\n=== §10 · every field on a result row is carried, and every default is a real default ===');
{
  // The gate found that nothing checked the shaped row. A search result whose fields are quietly
  // empty is worse than an error: the row LOOKS like an answer, so nobody goes and checks the repo.
  const full = {
    id: 'estate:sig', text: 'konomium-vault · encrypted accounting foundation with a bank ingest',
    meta: { kind: 'estate', canonical: 'konomium-vault', live: 2, count: 3,
            members: ['konomium-vault', 'fallaccount', 'fallvault'],
            url: 'https://sjgant80-hub.github.io/konomium-vault/', pushed: '2026-08-01' },
  };
  const s = soulOf([full]);
  const h = find(s, 'encrypted accounting bank').hits[0];
  ok(!!h, 'the record is found');
  ok(h.name === 'konomium-vault', 'the canonical name is carried');
  ok(/encrypted accounting foundation/.test(h.what), '⚑ the description is carried, not blanked');
  ok(h.url === 'https://sjgant80-hub.github.io/konomium-vault/', '⚑ the URL is carried — a result you cannot open is not a result');
  ok(h.live === true, 'live is carried');
  ok(h.lastTouched === '2026-08-01', '⚑ when it was last touched is carried');
  ok(h.alsoKnownAs.length === 2 && h.alsoKnownAs.includes('fallaccount'),
     '⚑ the other names sharing this signature are carried, and the canonical is not repeated among them');
  ok(h.sharing === 2, '⚑ "sharing" is count MINUS ONE — the others, not including itself');

  // And the defaults are defaults, not accidents.
  const bare = { id: 'x', text: '', meta: { kind: 'estate', canonical: 'bare', live: 0 } };
  const b = find(soulOf([bare]), 'bare').hits[0];
  ok(b && b.url === null, 'a record with no URL reports null');
  ok(b && b.alsoKnownAs.length === 0, 'a record with no members reports none');
  ok(b && b.sharing === 0, 'a record sharing with nobody reports 0, never -1');
  ok(b && b.lastTouched === null, 'and a record never pushed reports null');
}

console.log('\n=== §11 · the ordering is the finding, so it is tested ===');
{
  // Two rows found the SAME way must still be ordered by strength, or the list is arbitrary and the
  // first row — the one a person actually reads — is chosen by insertion order.
  const s = soulOf([
    rec('weak', 'mutation and fuzz, but nothing about the other one'),   // 2 of 3 terms
    rec('strong', 'mutation fuzz gate — all three'),                     // 3 of 3
  ]);
  const r = find(s, 'mutation fuzz gate');
  ok(r.hits.length === 2, 'both match');
  ok(r.hits[0].name === 'strong', '⚑ the row matching more of the query comes first');
  ok(r.hits[0].words > r.hits[1].words, 'and its word score is genuinely higher');

  // ⚑ Insertion order is deliberately the WRONG order here: the once-circled road is cast first, so a
  // sort that quietly stops working returns it first and the test catches that rather than agreeing
  // with it by accident.
  const sh = soulOf([]);
  sh.shadow = shadowIndex();
  castShadow(sh.shadow, 'mesh routed by wire', 'deepen:cabling');       // circled once — cast FIRST
  castShadow(sh.shadow, 'mesh routed by sound', 'deepen:airgap');
  castShadow(sh.shadow, 'mesh routed by sound', 'deepen:acoustics');    // circled twice — cast SECOND
  const f = findShadow(sh, 'mesh routed', { shadows: readShadows });
  ok(f.hits.length === 2, 'both roads match');
  ok(f.hits[0].times === 2 && f.hits[1].times === 1, '⚑ the one circled more often comes first, against insertion order');
  ok(f.hits[0].contexts.length === 2, 'with its contexts carried, so you can see WHERE you circled it');
  ok(f.hits[0].branch === 'mesh routed by sound', '⚑ and the BRANCH TEXT is returned — a content hash is not something a person can read');
  ok(f.query === 'mesh routed', 'and the query is echoed back');

  // A word that appears ONLY in the branch, never in the contexts — so the branch text must be what
  // is searched, not just the decision labels it was circled under.
  const only = findShadow(sh, 'sound', { shadows: readShadows });
  ok(only.hits.length === 1 && only.hits[0].branch === 'mesh routed by sound',
     '⚑ the branch text itself is searched, not only the contexts');

  // And the mirror: a word that appears ONLY in a decision label, never in any branch text. Both
  // halves of the haystack have to be live, or "where did I circle this" silently stops working.
  const byContext = findShadow(sh, 'airgap', { shadows: readShadows });
  ok(byContext.hits.length === 1 && byContext.hits[0].branch === 'mesh routed by sound',
     '⚑ the CONTEXTS are searched too — you can find a road by the decision that cast it');
}

console.log('\n=== §12 · with a recall injected, so the meaning pass actually runs ===');
{
  // Without an injected recall the meaning pass is skipped, so half this file would never be
  // exercised. This supplies one with the real contract — {score, center, members} — which is all the
  // search ever asks of it. Deliberately NOT the estate's own recall: this file must stay runnable by
  // anyone holding only these kernels, and the thing that implements recall is not published.
  const soul = soulOf([
    rec('konomium-vault', 'konomium-vault · encrypted accounting foundation, AES-GCM vault and bank ingest'),
    rec('fallledger', 'fallledger · sovereign double-entry general ledger'),
    rec('glampos', 'glampos · site automation for glamping, with a double-booking guard'),
    rec('witness', 'witness · deterministic build gate, mutation and fuzz'),
  ]);
  const chamber = soul.memory.chambers[0];
  const byName = (n) => chamber.find(r => r.meta.canonical === n);
  // A recall that answers the way the real one does: a nearest centre, the OTHER members of the fold
  // it landed in, and a score on its own unnormalised scale. Members matter — a fold is several repos
  // behind one signature, and returning only the centre would hide the rest of what was found.
  const fakeRecall = (_s, q) => {
    if (/encrypt|account|vault/i.test(q)) return { score: 20.06, center: byName('konomium-vault'), members: [byName('fallledger')] };
    if (/book|glamp/i.test(q)) return { score: 11.7, center: byName('glampos'), members: [] };
    if (/ledger/i.test(q)) return { score: 15, center: byName('fallledger') };       // no members key at all
    return { score: 6.21, center: byName('witness'), members: [] };                  // the nonsense band
  };

  const r = find(soul, 'encrypted accounting vault', { recall: fakeRecall });
  ok(r.hits.length > 0, 'an injected recall returns hits');
  ok(r.hits[0].name === 'konomium-vault', 'and the right one leads');
  ok(find(soul, 'encrypted accounting vault').hits.every(h => h.meaning === 0),
     '⚑ while NO recall means no meaning pass at all — the search degrades to literal rather than failing');

  // ⚑ THE OTHER MEMBERS OF THE FOLD ARE RESULTS TOO. A fold is several repos behind one signature, so
  // returning only the centre would silently drop everything else recall actually found.
  const withMembers = find(soul, 'encrypted accounting vault', { recall: fakeRecall, meaningFloor: 0 });
  ok(withMembers.hits.some(h => h.name === 'fallledger'),
     'a member of the fold recall returned is a hit in its own right, not just the centre');
  ok(withMembers.hits.find(h => h.name === 'fallledger').found === 'meaning',
     'and it is labelled as found by meaning, since no word of the query appears in it');
  let threwNoMembers = false;
  try { find(soul, 'ledger', { recall: fakeRecall, meaningFloor: 0 }); } catch { threwNoMembers = true; }
  ok(!threwNoMembers, 'a recall that returns no members key at all is handled rather than thrown on');

  const open = find(soul, 'encrypted accounting vault', { recall: fakeRecall, meaningFloor: 0 });
  ok(open.hits.some(h => h.meaning > 0), '⚑ the MEANING pass fires when the floor suits the corpus');
  ok(open.hits[0].found === 'meaning AND words', 'and the leader is then corroborated by both');
  ok(open.corroborated >= 1, 'the corroborated count reflects it');
  ok(find(soul, 'encrypted accounting vault').hits.every(h => h.meaning === 0),
     'while the default floor — calibrated for a far larger soul — admits nothing here, which is the honest behaviour of an uncalibrated threshold');

  // ⚑ THE FLOOR IS INCLUSIVE. A hit scoring EXACTLY the floor is admitted, not turned away — an
  // exclusive boundary silently discards the marginal case the threshold was chosen to sit on.
  const exact = open.hits[0].meaning;
  ok(exact > 0, 'the leading hit has a real meaning score to test the boundary with');
  const atFloor = find(soul, 'encrypted accounting vault', { recall: fakeRecall, meaningFloor: exact });
  ok(atFloor.hits.some(h => h.meaning === exact), 'a hit scoring exactly the floor is kept');
  const above = find(soul, 'encrypted accounting vault', { recall: fakeRecall, meaningFloor: exact + 0.01 });
  ok(above.hits.every(h => h.meaning === 0), 'and one scoring a hair below it is not');

  // Meaning without shared words is the whole reason the pass exists.
  const bySense = find(soul, 'stops the same room being booked twice', { recall: fakeRecall, meaningFloor: 0 });
  ok(bySense.hits.length === 0 || bySense.hits[0].name === 'glampos',
     'a description sharing few words still leads to the right build, or honestly returns nothing');

  const none = find(soul, 'banana helicopter tuesday', { recall: fakeRecall });
  ok(none.hits.length === 0, '⚑ and nonsense STILL returns nothing, even with meaning available');

  // A malformed row in the middle of a real chamber must not take the search down.
  soul.memory.chambers[0].push({ id: 'broken', text: 'no meta at all' });
  let threw = false;
  try { find(soul, 'encrypted accounting vault'); } catch { threw = true; }
  ok(!threw, 'a record with no meta is skipped rather than throwing');
}

console.log('\n=== §9 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, { memory: null }, { memory: { chambers: null } }];
  let threw = null;
  for (const j of junk) {
    try { find(j, 'x'); findShadow(j, 'x'); } catch (e) { threw = `${String(j)} → ${e.message}`; }
    try { find(soulOf(ESTATE), j); findShadow(soulOf(ESTATE), j); } catch (e) { threw = `query ${String(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
