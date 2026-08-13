// sessions.test.mjs — PROOF-OF-PLAY for learning from real sessions.
//
// The failure this kernel exists to prevent is not "missed a turn". It is si-didy learning from its
// OWN output — a system reminder wearing the user's role, a tool result delivered as a user message,
// a compaction summary the assistant wrote about itself. A memory that compounds cannot afford to
// mistake its own echo for the user, so nearly every test below is about keeping something OUT.
import { textOf, isUser, classify, redact, turn, digest, gist, KINDS } from './sessions.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

const said = (text, extra = {}) => ({
  type: 'user', timestamp: '2026-08-12T10:00:00Z', sessionId: 'aaaaaaaa-1111',
  message: { role: 'user', content: text }, ...extra,
});

console.log('\n=== §1 · the user speaking IS picked up ===');
{
  ok(isUser(said('give me the live link')), 'a plain user turn counts');
  ok(textOf(said('hello there')) === 'hello there', 'and its text comes through');
  const blocks = said('x');
  blocks.message.content = [{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }];
  ok(textOf(blocks) === 'first\nsecond', 'text blocks are joined');
}

console.log('\n=== §2 · ⚑ WHAT LOOKS LIKE THE USER AND IS NOT ===');
{
  ok(!isUser(said('<system-reminder>\nAs you answer, consider…\n</system-reminder>')),
     '⚑ a system reminder wears the user role and is NOT the user');
  ok(!isUser(said('This session is being continued from a previous conversation…')),
     '⚑ a continuation preamble is the harness, not Simon');
  ok(!isUser(said('Caveat: The messages below were generated while running a command')),
     'and neither is a caveat block');
  ok(!isUser(said('anything', { isMeta: true })), 'isMeta is excluded');
  ok(!isUser(said('anything', { isCompactSummary: true })),
     '⚑ a compaction summary is the ASSISTANT writing about itself — learning from it is learning an echo');
  ok(!isUser(said('anything', { isSidechain: true })), 'a subagent sidechain is a different conversation');
  ok(!isUser(said('anything', { toolUseResult: { ok: true } })), 'a tool result wearing the user role is not speech');
  ok(!isUser(said('', {})), 'an empty turn says nothing');

  const withTool = said('x');
  withTool.message.content = [{ type: 'tool_result', content: 'output' }, { type: 'text', text: 'here is what came back' }];
  ok(!isUser(withTool), '⚑ and a turn carrying a tool_result is a tool return however much prose rides with it');
  ok(textOf(withTool) === 'here is what came back', 'though its text is still readable if a caller wants it');

  const nonText = said('x');
  nonText.message.content = [{ type: 'image', source: {} }, { type: 'thinking', thinking: 'hmm' }];
  ok(textOf(nonText) === '', 'images and thinking blocks contribute no words');
  ok(!isUser({ type: 'assistant', message: { role: 'assistant', content: 'I built it' } }), 'and an assistant turn is never the user');
}

console.log('\n=== §2b · ⚑ THE PRINCIPLED FILTER IS A FIELD, NOT A PATTERN ===');
{
  // Found by ingesting for real: task notifications arrive as user turns and were being learned from.
  // `origin.kind` distinguishes them, and a field catches machine origins nobody has invented yet.
  ok(!isUser(said('the build finished', { origin: { kind: 'task-notification' } })),
     '⚑ a background task reporting back is not a person, whatever its text says');
  ok(isUser(said('yes mate', { origin: { kind: 'human' } })), 'a human-origin turn counts');
  ok(isUser(said('yes mate')), 'and so does one with no origin field at all — absence is not machine');
  ok(!isUser(said('x', { origin: { kind: 'hook' } })), 'any non-human origin is excluded, not just the known ones');

  // Tagged human but put in the user's mouth by the app — the field cannot catch these, so patterns do.
  ok(!isUser(said('My computer went to sleep while you were working. Please continue.', { origin: { kind: 'human' } })),
     'the sleep message is tagged human and is still not Simon typing');
  ok(!isUser(said('<task-notification>done</task-notification>', { origin: { kind: 'human' } })),
     'and a notification body is refused even if its origin says human');

  // ⚑ The honest converse: text in MY voice, tagged human, is Simon PASTING it — real input, kept.
  ok(isUser(said('Right — let me go all the way down on both, because you are right', { origin: { kind: 'human' } })),
     '⚑ assistant-sounding text with a human origin was PASTED by the user, and pasting is speaking');
}

console.log('\n=== §3 · ⚑ CORRECTIONS ARE LABELLED, NOT SCORED ===');
{
  ok(classify('no mate thats wrong') === 'correction', 'a plain no is a correction');
  ok(classify('you keep stopping doing it') === 'correction', '⚑ "you keep…" is the most valuable sentence in a transcript');
  ok(classify('why arent we using dodeca memory?') === 'correction', 'and so is a why-arent-we');
  ok(classify('always give me the live url') === 'standing-rule', 'an always is a standing rule');
  ok(classify('never commit the seed') === 'standing-rule', 'and so is a never');
  ok(classify('from now on push every build') === 'standing-rule', 'and a from-now-on');
  ok(classify('build me a search endpoint') === 'ask', 'an ordinary request is just an ask');
  ok(KINDS.length === 3, 'three kinds, and nothing is forced into a bucket it does not fit');
  // A standing rule that also reads as a correction is the STRONGER claim — it changes future work.
  ok(classify('you never give me the live link') === 'standing-rule', 'a standing rule outranks a correction when both fire');
}

console.log('\n=== §4 · ⚑ SECRETS NEVER ENTER THE SOUL ===');
{
  // soul.json is written to disk and read back for years. A swallowed token outlives the leak.
  const k = 'sk-ant-' + 'A'.repeat(20);
  ok(!redact(`my key is ${k}`).includes(k), 'an API key is redacted');
  ok(redact(`my key is ${k}`).includes('«redacted-key»'), 'and marked so the gap is visible');
  const gh = 'ghp_' + 'b'.repeat(20);
  ok(!redact(gh).includes(gh), 'a GitHub token is redacted');
  ok(!redact('Bearer abcdefghijklmnopqrstuvwx').includes('abcdefghijklmnopqrstuvwx'), 'a bearer token is redacted');
  ok(!redact('mail me at simon@example.com').includes('simon@example.com'), 'an email address is redacted');
  ok(redact('nothing secret here') === 'nothing secret here', 'and ordinary text is untouched');
  const t = turn(said(`the key is ${k} ok`));
  ok(t && !t.text.includes(k), '⚑ redaction happens on the way IN, so the soul never holds it at all');
}

console.log('\n=== §5 · a turn is compressed, not copied ===');
{
  const long = 'x'.repeat(5000);
  const t = turn(said(long), { max: 100 });
  ok(t.text.length <= 101, 'a huge paste is capped');
  ok(t.long === true, 'and flagged as truncated rather than silently shortened');
  ok(turn(said('short one')).long === false, 'a short turn is not flagged');
  ok(turn(said('hi')).at === '2026-08-12', 'the date is kept to the day');
  ok(turn(said('hi')).session === 'aaaaaaaa', 'and the session to a short id');
  ok(turn(said('<system-reminder>x</system-reminder>')) === null, 'and an injected turn yields no turn at all');
}

console.log('\n=== §6 · ⚑ RECURRENCE IS COUNTED BY SESSION, NEVER BY REPETITION ===');
{
  const mk = (text, session) => turn({ ...said(text), sessionId: session });
  // Said three times in ONE sitting: a person repeating themselves, not a standing expectation.
  const oneSitting = digest([mk('give me the live link', 's1'), mk('give me the live link', 's1'), mk('give me the live link', 's1')]);
  ok(oneSitting.recurring.length === 0, '⚑ the same ask three times in ONE session is not a pattern');
  ok(oneSitting.turns === 3, 'though all three turns are counted');

  // Said once each in two different sittings: something that keeps being missed.
  const across = digest([mk('give me the live link', 's1'), mk('give me the live link', 's2')]);
  ok(across.recurring.length === 1, 'the same ask in TWO sessions is');
  ok(across.recurring[0].sessions === 2, 'and it reports how many sessions');
  ok(across.sessions === 2, 'the session count is distinct too');

  const mixed = digest([mk('no thats wrong', 's1'), mk('always push the build', 's2'), mk('build a thing', 's3')]);
  ok(mixed.byKind.correction === 1 && mixed.byKind['standing-rule'] === 1 && mixed.byKind.ask === 1, 'each kind is counted');
  ok(mixed.corrections.length === 1 && /wrong/.test(mixed.corrections[0].text), 'and the corrections come back in full, not as a number');
}

console.log('\n=== §7 · the gist collides rephrasings without collapsing different asks ===');
{
  ok(gist('give me the live link') === gist('the live link, give me'), 'word order does not matter');
  ok(gist('give me the live link mate') === gist('give me the live link'), 'and neither does an address');
  ok(gist('build the search') !== gist('build the ledger'), '⚑ but two different requests do NOT collide');
  ok(gist('ok') === '', 'a turn with nothing content-bearing has no gist');
  ok(gist('yeh dude ok') === '', 'and neither does pure assent — those are not requests');
}

console.log('\n=== §9 · the boundaries, and the counts said exactly ===');
{
  // Exactly `max` is not too long. An off-by-one here silently truncates and flags every turn that
  // lands on the limit, and the flag is what tells a reader something was lost.
  const exact = turn(said('y'.repeat(100)), { max: 100 });
  ok(exact.text.length === 100 && exact.long === false, '⚑ a turn of exactly max length is kept whole and NOT flagged');
  const over = turn(said('y'.repeat(101)), { max: 100 });
  ok(over.long === true, 'one character more is flagged');

  const mk = (text, session) => turn({ ...said(text), sessionId: session });
  // Counts must be exact — pre-seeding every kind to 0 hides a broken increment on the FIRST hit.
  const two = digest([mk('no thats wrong', 's1'), mk('no thats broken', 's2')]);
  ok(two.byKind.correction === 2, '⚑ two corrections count as 2, not 1 — the second increment is real work');
  ok(/2 corrections/.test(two.line), 'and the summary line reports 2, not 0');
  const rules = digest([mk('always push it', 's1'), mk('never skip it', 's2')]);
  ok(/2 standing rules/.test(rules.line), 'standing rules are counted in the line too');

  // Ties in the recurring list resolve by gist, so the order is stable rather than insertion-dependent.
  const tied = digest([
    mk('zebra pipeline build', 's2'), mk('zebra pipeline build', 's1'),
    mk('alpha ledger build', 's2'), mk('alpha ledger build', 's1'),
  ]);
  ok(tied.recurring.length === 2, 'both recur');
  ok(tied.recurring[0].gist < tied.recurring[1].gist, '⚑ an equal session count breaks the tie alphabetically, so the order is deterministic');

  // The tersest phrasing is the example, and equal lengths keep the first seen rather than flapping.
  // Same content words, different phrasings — so they share a gist and the tersest wins.
  const terse = digest([mk('build the search', 's1'), mk('search build', 's2')]);
  ok(terse.recurring.length === 1, 'two phrasings of one request are one recurring entry');
  ok(terse.recurring[0].example === 'search build', 'and the shortest phrasing is the one shown');

  // ⚑ EQUAL LENGTHS KEEP THE FIRST SEEN. Otherwise the example flips to whichever phrasing happened to
  // be read last, and the same digest run twice over reordered input reports different text.
  const same = digest([mk('build search', 's1'), mk('search build', 's2')]);
  ok(same.recurring.length === 1, 'both phrasings share one entry');
  ok(same.recurring[0].example === 'build search', 'and an equal-length rival does not displace the one already held');
}

console.log('\n=== §10 · content blocks, and turns that are not the user ===');
{
  const blocks = said('x');
  blocks.message.content = [{ type: 'text', text: 'give me the live link' }];
  ok(isUser(blocks) === true, '⚑ a turn whose content is TEXT BLOCKS is still the user speaking');

  const withNull = said('x');
  withNull.message.content = [null, { type: 'text', text: 'real words' }];
  let threw = false;
  try { isUser(withNull); } catch { threw = true; }
  ok(!threw, 'a null block among real ones does not throw');
  ok(isUser(withNull) === true, 'and the turn still counts');

  ok(isUser(said('hello', { userType: 'external' })) === true, 'an external user is the user');
  ok(isUser(said('hello', { userType: 'internal' })) === false, '⚑ and a non-external userType is not');
}

console.log('\n=== §8 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, { type: 'user' }, { type: 'user', message: null },
                { type: 'user', message: { content: 7 } }, { message: { content: [null, 3] } }];
  let threw = null;
  for (const j of junk) {
    try { isUser(j); textOf(j); turn(j); } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
    try { classify(j); redact(j); gist(j); digest(j); } catch (e) { threw = `arg ${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(digest(null).turns === 0 && digest(null).recurring.length === 0, 'and a non-list digests to nothing');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
