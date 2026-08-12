// ledger.mjs — MONEY, AND THE ONE RULE THAT MAKES A NUMBER TRUSTWORTHY.
/* --- organ
 * name: ledger
 * does: double-entry bookkeeping that cannot be made to disagree with itself
 * caps: none
 * --- */
//
// ⚑ AN ENTRY THAT DOES NOT BALANCE IS NOT RECORDED. Not flagged, not queued for review, not saved
// with a warning — refused at the point of writing. Every accounting scandal of the last century has
// the same shape underneath: a number that was allowed in while it was wrong, and reconciled later by
// someone with a reason. Balance checked at write time is the difference between a ledger and a list.
//
// The second rule is that HISTORY IS APPEND-ONLY. A correction is a new entry that reverses an old
// one, never an edit. An edited ledger cannot be audited, because the thing an auditor needs is not
// the current balance — it is the sequence that produced it.

/** A posting: one account, one signed amount, in minor units (pence) so nothing is ever a float. */
export function post(account, amount) {
  const a = String(account || '').trim();
  const n = Number(amount);
  if (!a) throw new TypeError('a posting needs an account');
  if (!Number.isInteger(n)) throw new TypeError(`amount must be whole minor units (pence), got ${amount}`);
  return { account: a, amount: n };
}

export function ledger(name = 'ledger') {
  return { name: String(name), entries: [], refused: [] };
}

/**
 * Record one entry: a description and two or more postings that MUST sum to zero.
 *
 * Returns `{ok:false}` rather than throwing, because a refusal is a normal outcome a caller should
 * handle — but nothing is written either way.
 */
export function record(led, description, postings) {
  const desc = String(description || '').trim();
  const list = Array.isArray(postings) ? postings : [];

  if (!desc) return refuse(led, 'an entry with no description cannot be audited later', desc, list);
  if (list.length < 2) return refuse(led, 'double entry needs at least two postings — one side is not an entry, it is an opinion', desc, list);
  for (const p of list) {
    if (!p || typeof p.account !== 'string' || !Number.isInteger(p.amount)) {
      return refuse(led, 'every posting needs an account and a whole-pence amount', desc, list);
    }
  }
  const sum = list.reduce((s, p) => s + p.amount, 0);
  if (sum !== 0) {
    return refuse(led, `the postings sum to ${sum}, not 0 — an entry that does not balance is not recorded`, desc, list);
  }

  const entry = { at: led.entries.length, description: desc, postings: list.map(p => ({ ...p })) };
  led.entries.push(entry);
  return { ok: true, why: `recorded: ${desc}`, entry };
}

function refuse(led, why, description, postings) {
  led.refused.push({ at: led.entries.length + led.refused.length, description, postings, why });
  return { ok: false, why };
}

/**
 * Reverse an earlier entry.
 *
 * ⚑ A CORRECTION IS A NEW ENTRY, NEVER AN EDIT. The original stays exactly where it was, and the
 * reversal sits after it, so the sequence tells the truth about what happened AND about what was
 * believed at the time. That second thing is the whole reason auditors exist.
 */
export function reverse(led, at, why = 'correction') {
  const orig = led.entries[at];
  if (!orig) return { ok: false, why: `there is no entry ${at} to reverse` };
  return record(led, `REVERSAL of #${at} (${orig.description}) — ${why}`,
    orig.postings.map(p => ({ account: p.account, amount: -p.amount })));
}

/** Balances by account, and the trial balance, which is zero by construction rather than by luck. */
export function balances(led) {
  const by = {};
  for (const e of led.entries) for (const p of e.postings) by[p.account] = (by[p.account] || 0) + p.amount;
  const total = Object.values(by).reduce((s, n) => s + n, 0);
  return {
    accounts: Object.fromEntries(Object.entries(by).sort(([a], [b]) => a.localeCompare(b))),
    total,
    // Stated rather than assumed. If this is ever non-zero the kernel is broken, and saying so in the
    // output is how that gets noticed instead of quietly accumulating.
    balanced: total === 0,
    entries: led.entries.length, refused: led.refused.length,
    line: `${led.entries.length} entr${led.entries.length === 1 ? 'y' : 'ies'}, ${led.refused.length} refused, trial balance ${total === 0 ? 'zero' : 'BROKEN: ' + total}`,
  };
}

export default { post, ledger, record, reverse, balances };
