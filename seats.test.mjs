// seats.test.mjs — PROOF-OF-PLAY for the four business organs.
//
// These exist so si-didy can fill the seats it had no gear for. Each one is a refusal wearing a
// business hat, and the tests aim at exactly that refusal — because a ledger that accepts an unbalanced
// entry, a pipeline that lets you drag a card to Commit, a deadline that guesses, or a roster you can
// write a skill into are all the same failure: recording a wish as a fact.
import { post, ledger, record, reverse, balances } from './organs/ledger.mjs';
import { STAGES, deal, learn, moveTo, forecast } from './organs/pipeline.mjs';
import { RULES, addDays, due, overdue } from './organs/deadline.mjs';
import { roster, join, demonstrated, has, whoCan } from './organs/roster.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const D = (s) => new Date(s + 'T00:00:00Z');

console.log('\n=== §1 · ⚑ AN ENTRY THAT DOES NOT BALANCE IS NOT RECORDED ===');
{
  const l = ledger('test');
  const bad = record(l, 'a sale', [post('bank', 1000), post('sales', -900)]);
  ok(!bad.ok, 'postings summing to 100 are refused');
  ok(/does not balance is not recorded/.test(bad.why), 'and the reason says so');
  ok(l.entries.length === 0, '⚑ and NOTHING was written — not queued, not flagged');
  ok(l.refused.length === 1, 'though the attempt is kept, so the refusal is auditable too');

  const good = record(l, 'a sale', [post('bank', 1000), post('sales', -1000)]);
  ok(good.ok && l.entries.length === 1, 'a balanced entry is recorded');
  ok(!record(l, '', [post('a', 1), post('b', -1)]).ok, 'an entry with no description is refused — it could not be audited later');
  ok(!record(l, 'one-sided', [post('bank', 0)]).ok, 'a single posting is refused: one side is not an entry');
  ok(!record(l, 'junk', 'not an array').ok, 'and a non-list of postings is refused rather than coerced');
}

console.log('\n=== §2 · whole pence only, and history is append-only ===');
{
  ok((() => { try { post('bank', 10.5); return false; } catch { return true; } })(), 'a fractional amount throws — money is never a float here');
  const l = ledger();
  record(l, 'fee', [post('bank', -500), post('fees', 500)]);
  const r = reverse(l, 0, 'charged in error');
  ok(r.ok && l.entries.length === 2, '⚑ a correction is a NEW entry, so the original is still there');
  ok(/REVERSAL of #0/.test(l.entries[1].description), 'and it says what it reverses');
  ok(balances(l).total === 0 && balances(l).accounts.bank === 0, 'and the two cancel exactly');
  ok(!reverse(l, 99).ok, 'reversing an entry that does not exist is refused');
  ok(balances(l).balanced === true, 'the trial balance is reported, not assumed');
}

console.log('\n=== §3 · ⚑ A DEAL CANNOT ENTER A STAGE IT HAS NOT EARNED ===');
{
  const d = deal('Acme');
  const jump = moveTo(d, 'commit');
  ok(!jump.ok, 'a fresh lead cannot be dragged to Commit');
  ok(/has not earned/.test(jump.why) && /missing contact, amount, sent, date/.test(jump.why), 'and every missing piece of evidence is named');
  ok(d.stage === 'lead', 'the deal did not move');

  learn(d, 'contact', 'Jane'); ok(moveTo(d, 'qualified').ok, 'with a named contact it can qualify');
  learn(d, 'amount', 5000);    ok(moveTo(d, 'scoped').ok, 'with a number it can be scoped');
  learn(d, 'sent', '2026-08-01'); ok(moveTo(d, 'proposed').ok, 'once something was sent it is proposed');
  ok(!moveTo(d, 'commit').ok, 'but commit still needs a date THEY named');
  learn(d, 'date', '2026-09-01'); ok(moveTo(d, 'commit').ok, 'and with it, commit is earned');

  ok(!learn(d, 'note', '').ok, 'learning an empty value records nothing');
  ok(moveTo(d, 'qualified').ok, '⚑ moving BACKWARDS needs no evidence — bad news must be easy to record');
  ok(!moveTo(d, 'atrium').ok, 'an unknown stage is refused');
}

console.log('\n=== §4 · ⚑ THE FORECAST CARRIES ITS EXCLUSIONS ===');
{
  const won = deal('Won'); Object.assign(won.facts, { amount: 1000 }); won.stage = 'won';
  const com = deal('Committed'); Object.assign(com.facts, { amount: 2000 }); com.stage = 'commit';
  const hopeful = deal('Hopeful'); Object.assign(hopeful.facts, { amount: 9000 }); hopeful.stage = 'proposed';
  const vague = deal('Vague'); vague.stage = 'commit';

  const f = forecast([won, com, hopeful, vague]);
  ok(f.won === 1000 && f.committed === 2000 && f.total === 3000, 'only won and committed deals with amounts are counted');
  ok(f.excluded.length === 2, 'the other two are excluded');
  ok(f.excluded.some(e => /short of commit/.test(e.why)), 'a proposed deal is excluded for being short of commit');
  ok(f.excluded.some(e => /no amount/.test(e.why)), 'and a commit with no number cannot be forecast');
  ok(/2 of 4 deals counted/.test(f.line), 'the line reports the denominator, not just the numerator');
  ok(/2 excluded and listed/.test(f.line), '⚑ and says the exclusions are listed, rather than hiding them');
  ok(forecast(null).total === 0, 'a non-list forecasts nothing rather than throwing');
}

console.log('\n=== §5 · ⚑ AN UNKNOWN LEGAL RULE IS REFUSED, NEVER ESTIMATED ===');
{
  const u = due('some-rule-i-invented', D('2026-08-01'));
  ok(u.known === false && u.due === null, 'an unknown rule returns no date at all');
  ok(/NOT estimated/.test(u.why), 'and says explicitly that it was not estimated');
  ok(/more dangerous than none/.test(u.why), 'with the reason: a plausible date does not get checked by a person');
  ok(Array.isArray(u.known_rules) && u.known_rules.length === Object.keys(RULES).length, 'and it lists what it DOES know');

  const k = due('dsar', D('2026-08-01'));
  ok(k.known && k.due === '2026-08-31', 'a known rule computes: 30 days from 1 Aug is 31 Aug');
  ok(/UK GDPR Art\.12\(3\)/.test(k.source), 'every rule carries its source');
  ok(/NOT legal advice/.test(k.bound), '⚑ and every result carries the bound, not a footer');
  ok(due('dsar', 'not-a-date').due === null, 'an unparseable start date yields no date');
}

console.log('\n=== §6 · date arithmetic, and never reading a clock ===');
{
  ok(addDays(D('2026-08-01'), 14).toISOString().slice(0, 10) === '2026-08-15', '14 calendar days');
  // 2026-08-01 is a Saturday; five working days lands on the following Friday.
  const wd = addDays(D('2026-08-01'), 5, { workingDaysOnly: true });
  ok(wd.getUTCDay() !== 0 && wd.getUTCDay() !== 6, 'a working-day result never lands on a weekend');
  ok(/bank holidays are not known/.test(due('dsar', D('2026-08-01'), { workingDaysOnly: true }).bound), 'and the bank-holiday gap is admitted');
  ok(overdue([], 'nonsense').ok === false, 'overdue() refuses without a valid comparison date');
  const items = [due('dsar', D('2026-01-01')), due('lba-response', D('2026-08-01')), due('nope', D('2026-01-01'))];
  const o = overdue(items, D('2026-08-12'));
  ok(o.late.length === 1 && o.live.length === 1 && o.unknown.length === 1, 'overdue splits late, live and unknown — the unknown are not silently dropped');
}

console.log('\n=== §7 · ⚑ YOU CANNOT CLAIM A SKILL, ONLY DEMONSTRATE IT ===');
{
  const r = roster();
  join(r, 'Ada');
  ok(has(r, 'Ada', 'welding', D('2026-08-12')).can === false, 'a person on the roster can do nothing by default');
  ok(/nothing on record/.test(has(r, 'Ada', 'welding', D('2026-08-12')).why), 'and the reason is absence of record, not failure');

  const self = demonstrated(r, 'Ada', 'welding', { on: D('2026-08-01'), evidence: 'welded the gate', by: 'Ada' });
  ok(!self.ok, '⚑ a self-witnessed demonstration is REFUSED');
  ok(/claim wearing a record's clothes/.test(self.why), 'and named for what it is');

  ok(!demonstrated(r, 'Ada', 'welding', { on: D('2026-08-01'), evidence: 'yes', by: 'Bob' }).ok, 'evidence too thin to check is refused');
  ok(!demonstrated(r, 'Ada', 'welding', { on: D('2026-08-01'), evidence: 'welded the gate', by: '' }).ok, 'a demonstration with no witness is refused');
  ok(!demonstrated(r, 'Nobody', 'welding', { on: D('2026-08-01'), evidence: 'welded the gate', by: 'Bob' }).ok, 'and so is one for a person not on the roster');

  const good = demonstrated(r, 'Ada', 'welding', { on: D('2026-08-01'), evidence: 'welded the north gate, photos in job 41', by: 'Bob' });
  ok(good.ok, 'a witnessed demonstration with checkable evidence is recorded');
  ok(has(r, 'Ada', 'welding', D('2026-08-12')).can === true, 'and now she can');
}

console.log('\n=== §8 · ⚑ A DEMONSTRATION EXPIRES ===');
{
  const r = roster();
  join(r, 'Ada');
  demonstrated(r, 'Ada', 'first-aid', { on: D('2026-01-01'), evidence: 'certificate 7781, assessed in person', by: 'Bob', expiresInDays: 90 });
  ok(has(r, 'Ada', 'first-aid', D('2026-02-01')).can === true, 'inside the window she can');
  const later = has(r, 'Ada', 'first-aid', D('2026-08-12'));
  ok(later.can === false, 'outside it she cannot');
  ok(/not a boolean that stays true/.test(later.why), 'and the reason is that skills are not a boolean that stays true');
  ok(has(r, 'Ada', 'first-aid', 'nonsense').can === false, 'without a valid date it answers no rather than guessing');

  join(r, 'Cy');
  demonstrated(r, 'Cy', 'first-aid', { on: D('2026-08-01'), evidence: 'certificate 9902, assessed in person', by: 'Bob' });
  const w = whoCan(r, 'first-aid', D('2026-08-12'));
  ok(w.can.length === 1 && w.can[0] === 'Cy', 'whoCan lists only the live ones');
  ok(w.lapsed.length === 1 && w.lapsed[0] === 'Ada', '⚑ and names the lapsed separately rather than dropping them');
}

console.log('\n=== §10 · the boundaries the gate found — exact dates, exact edges ===');
{
  // 2026-08-03 is a Monday. Five working days later is Monday the 10th. Off by one in either
  // direction — counting weekends, or one extra iteration — lands somewhere else, and a legal
  // deadline that is one day out is the whole failure this organ exists to prevent.
  ok(addDays(D('2026-08-03'), 5, { workingDaysOnly: true }).toISOString().slice(0, 10) === '2026-08-10',
     '⚑ five working days from Monday 3 Aug is Monday 10 Aug — exactly');
  ok(addDays(D('2026-08-03'), 5).toISOString().slice(0, 10) === '2026-08-08', 'five calendar days is Saturday 8 Aug');
  ok(addDays(D('2026-08-03'), 0, { workingDaysOnly: true }).toISOString().slice(0, 10) === '2026-08-03', 'zero days does not move');
  ok(addDays(D('2026-08-10'), -5, { workingDaysOnly: true }).toISOString().slice(0, 10) === '2026-08-03', 'and it runs backwards symmetrically');

  // The options object must actually be read — a mutant that ignored it silently returned calendar days.
  ok(addDays(D('2026-08-03'), 5, { workingDaysOnly: true }).getTime() !== addDays(D('2026-08-03'), 5).getTime(),
     '⚑ passing workingDaysOnly CHANGES the answer — proof the options are read, not defaulted away');
  let threw = false;
  try { addDays(D('2026-08-03'), 5, null); due('dsar', D('2026-08-01'), null); } catch { threw = true; }
  ok(!threw, 'and an explicit null options object does not throw');

  // Due exactly today is not yet late. Off-by-one here is somebody told they missed a deadline they did not.
  const exact = due('lba-response', D('2026-08-01'));            // 14 days → 2026-08-15
  ok(exact.due === '2026-08-15', 'a 14-day rule from 1 Aug falls due on 15 Aug');
  ok(overdue([exact], D('2026-08-15')).live.length === 1, '⚑ due EXACTLY today is live, not late');
  ok(overdue([exact], D('2026-08-16')).late.length === 1, 'and late the day after');

  ok(overdue([null, undefined], D('2026-08-12')).unknown.length === 2,
     'null entries land in unknown rather than throwing — a broken row must not be silently counted as live');
}

console.log('\n=== §11 · the boundaries: ledger and roster ===');
{
  const l = ledger();
  record(l, 'one', [post('a', 1), post('b', -1)]);
  ok(/^1 entry,/.test(balances(l).line), 'one entry reads "1 entry"');
  record(l, 'two', [post('a', 1), post('b', -1)]);
  ok(/^2 entries,/.test(balances(l).line), 'two read "2 entries"');
  let threw = false;
  try { threw = record(l, 'nulls', [null, post('a', 0)]).ok; } catch { threw = 'threw'; }
  ok(threw === false, 'a null posting is refused rather than throwing on it');

  const r = roster(); join(r, 'Ada');
  ok(demonstrated(r, 'Ada', 's', { on: D('2026-08-01'), evidence: '12345678', by: 'Bob' }).ok,
     '⚑ evidence of exactly 8 characters is accepted — the boundary is < 8, not <= 8');
  ok(!demonstrated(r, 'Ada', 's', { on: D('2026-08-01'), evidence: '1234567', by: 'Bob' }).ok, 'seven is not');

  const r2 = roster(); join(r2, 'Ada');
  demonstrated(r2, 'Ada', 'fa', { on: D('2026-01-01'), evidence: 'assessed in person, cert 1', by: 'Bob', expiresInDays: 90 });
  ok(has(r2, 'Ada', 'fa', D('2026-04-01')).can === true, '⚑ a demonstration expiring exactly today still counts');
  ok(has(r2, 'Ada', 'fa', D('2026-04-02')).can === false, 'and not the day after');

  ok(/Bob is not on the roster/.test(demonstrated(r2, 'Bob', 'x', { on: D('2026-08-01'), evidence: 'something checkable', by: 'Ada' }).why),
     'a stranger is refused BY NAME, so the message says who');
  let t2 = false;
  try { join(null, 'x'); demonstrated(null, 'a', 'b', {}); has(null, 'a', 'b', D('2026-08-01')); whoCan(null, 'x', D('2026-08-01')); } catch { t2 = true; }
  ok(!t2, 'and every roster function refuses a non-roster rather than throwing');
}

console.log('\n=== §12 · the boundaries: pipeline ===');
{
  const d = deal('Acme');
  ok(d.name === 'Acme', 'a deal keeps the name it was given');
  ok(!moveTo(d, 'qualified').ok, '⚑ even ONE stage forward is refused without its evidence');
  ok(!learn(d, 'contact', undefined).ok, 'learning undefined records nothing');
  ok(!learn(d, 'contact', null).ok, 'nor null');

  learn(d, 'contact', 'Jane');
  ok(moveTo(d, 'qualified').ok, 'and with it, one stage forward is fine');
  d.facts.contact = null;
  ok(!moveTo(d, 'scoped').ok, 'a fact set back to null stops the next move — presence is not enough, it must have a value');

  // Re-entering the SAME stage is not a promotion and must not be re-gated.
  const e = deal('Beta');
  learn(e, 'contact', 'Jo'); learn(e, 'amount', 100); learn(e, 'sent', 'x'); learn(e, 'date', 'y');
  moveTo(e, 'commit');
  delete e.facts.date;
  ok(moveTo(e, 'commit').ok, 'staying where you are is allowed even once a fact is gone');
  ok(moveTo(e, 'lead').ok, 'and falling back is always allowed');

  let threw = false;
  try { forecast([null, undefined, { name: 'no facts', stage: 'commit' }]); } catch { threw = true; }
  ok(!threw, 'forecasting over broken rows does not throw');
  ok(forecast([{ name: 'no facts', stage: 'commit' }]).excluded.length === 1, 'and a deal with no facts is excluded, not counted');
}

console.log('\n=== §13 · the last five the gate found ===');
{
  // ⚑ A POSTING THAT BALANCES CAN STILL BE INVALID. Two halves of 0.5 sum to zero, so the balance
  // check alone lets them through — it is the per-posting integer check that stops fractional pence
  // entering the books, and only a balanced-but-fractional entry proves that check is doing work.
  const l = ledger();
  const frac = record(l, 'halves', [{ account: 'a', amount: 0.5 }, { account: 'b', amount: -0.5 }]);
  ok(!frac.ok, '⚑ fractional amounts that SUM TO ZERO are still refused');
  ok(l.entries.length === 0, 'and nothing was written');

  record(l, 'ok', [post('a', 1), post('b', -1)]);
  ok(/trial balance zero$/.test(balances(l).line), 'a balanced ledger says "trial balance zero", not "BROKEN"');

  // ⚑ AN EMPTY STRING IS A MISSING FACT. A CRM that treats "" as filled-in is how a deal reaches
  // Commit with a blank contact — the field exists, so the check passes, and nobody notices.
  const d = deal('Gamma');
  d.facts.contact = '';
  ok(!moveTo(d, 'qualified').ok, 'a fact present but EMPTY still counts as missing');
  ok(/missing contact/.test(moveTo(d, 'qualified').why), 'and is named as missing');
  d.facts.contact = null;
  ok(!moveTo(d, 'qualified').ok, 'and so does null');

  // due() must read its options, exactly as addDays does.
  const cal = due('acas-early-con', D('2026-08-03'));
  const wrk = due('acas-early-con', D('2026-08-03'), { workingDaysOnly: true });
  ok(cal.due !== wrk.due, '⚑ due() with workingDaysOnly gives a DIFFERENT date — proof it reads its options');
  ok(wrk.workingDaysOnly === true, 'and reports which mode it used');

  // known:true but due:null — a rule it knows, from a date it could not parse. Neither late nor live.
  const unparseable = due('dsar', 'the fourteenth of never');
  ok(unparseable.known === true && unparseable.due === null, 'a known rule with an unreadable start date yields no date');
  const o = overdue([unparseable], D('2026-08-12'));
  ok(o.unknown.length === 1 && o.late.length === 0,
     '⚑ and it lands in UNKNOWN — never silently treated as overdue, which would invent a missed deadline');
}

console.log('\n=== §9 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN];
  let threw = null;
  for (const j of junk) {
    try {
      const l = ledger(j); record(l, j, j); balances(l);
      const d = deal(j); moveTo(d, j); learn(d, j, j); forecast(j);
      due(j, j); overdue(j, j);
      const r = roster(j); join(r, j); demonstrated(r, j, j, j); has(r, j, j, j); whoCan(r, j, j);
    } catch (e) { threw = `${String(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no kernel throws on garbage' + (threw ? ' — ' + threw : ''));
  ok(STAGES.length === 7 && STAGES.every(s => s.is), 'every stage says what it means in plain words');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
