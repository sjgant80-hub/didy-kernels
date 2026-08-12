// deadline.mjs — LEGAL DATES, AND THE REFUSAL THAT MAKES THEM SAFE.
/* --- organ
 * name: deadline
 * does: statutory deadline arithmetic that refuses rather than estimates
 * caps: none
 * --- */
//
// ⚑ AN UNKNOWN RULE IS REFUSED. NEVER ESTIMATED. This is the single most important line in the file.
// A wrong legal deadline is not a slightly-wrong answer, it is a missed limitation period and a
// struck-out claim — and a plausible guess is far more dangerous than a blank, because a blank gets
// checked by a human and a guess does not. Every rule here is named, with its source, or it does not
// exist. [[redress-engine]] and [[falljustice]] hold the same position.
//
// ⚑ AND IT IS NOT LEGAL ADVICE. It is date arithmetic against rules someone entered. Said in the
// output of every calculation, not in a footer nobody reads.

// Deliberately a small, explicitly-sourced table. Adding a rule means naming where it comes from.
export const RULES = {
  'lba-response':        { days: 14, from: 'service',  what: 'response to a letter before action', source: 'Practice Direction — Pre-Action Conduct, §6' },
  'dsar':                { days: 30, from: 'receipt',  what: 'subject access request response',    source: 'UK GDPR Art.12(3)' },
  'acas-early-con':      { days: 28, from: 'notify',   what: 'ACAS early conciliation period',     source: 'Employment Tribunals Act 1996 s.18A' },
  'small-claim-defence': { days: 14, from: 'service',  what: 'defence to a small claim',           source: 'CPR 15.4(1)(a)' },
  'cancellation':        { days: 14, from: 'delivery', what: 'consumer cancellation period',       source: 'Consumer Contracts Regulations 2013, reg.30' },
};

const DAY = 86400000;
const isDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
const iso = (d) => d.toISOString().slice(0, 10);

/** Working days skip Saturday and Sunday. Bank holidays are NOT known here, and that is stated. */
export function addDays(from, n, opts) {
  const { workingDaysOnly = false } = (opts && typeof opts === 'object') ? opts : {};
  if (!isDate(from)) throw new TypeError('addDays needs a valid Date');
  if (!Number.isInteger(n)) throw new TypeError('addDays needs a whole number of days');
  if (!workingDaysOnly) return new Date(from.getTime() + n * DAY);

  const d = new Date(from.getTime());
  let left = Math.abs(n), step = Math.sign(n) || 1;
  while (left > 0) {
    d.setTime(d.getTime() + step * DAY);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * When is it due?
 *
 * Returns a refusal object for an unknown rule. It does not throw, because a caller looping over
 * several rules should get a clear "I do not know this one" per rule rather than a stack trace — and
 * it does not guess, because guessing is the failure this organ exists to prevent.
 */
export function due(ruleId, startDate, opts) {
  const { workingDaysOnly = false } = (opts && typeof opts === 'object') ? opts : {};
  const rule = RULES[String(ruleId)];
  if (!rule) {
    return {
      known: false, rule: String(ruleId), due: null,
      why: `no rule called "${ruleId}" is known here. It is NOT estimated — an invented legal deadline is more dangerous than none, because a blank gets checked by a person and a plausible date does not.`,
      known_rules: Object.keys(RULES),
    };
  }
  const start = startDate instanceof Date ? startDate : new Date(String(startDate));
  if (!isDate(start)) {
    return { known: true, rule: ruleId, due: null, why: `"${startDate}" is not a date this can start from` };
  }

  const end = addDays(start, rule.days, { workingDaysOnly });
  return {
    known: true, rule: ruleId, what: rule.what, source: rule.source,
    from: rule.from, start: iso(start), days: rule.days, workingDaysOnly,
    due: iso(end),
    // Carried in every result rather than assumed. A date organ that lets itself be read as advice is
    // the same failure as a gate that lets itself be read as a guarantee.
    bound: 'Date arithmetic against a named rule — NOT legal advice, and bank holidays are not known here, so a working-day answer may fall on one.',
    line: `${rule.what}: ${rule.days} days from ${rule.from} (${iso(start)}) → due ${iso(end)} · ${rule.source}`,
  };
}

/** Which of these have passed, relative to a date the caller supplies. Never reads a clock. */
export function overdue(items, asOf) {
  const now = asOf instanceof Date ? asOf : new Date(String(asOf));
  if (!isDate(now)) return { ok: false, why: 'overdue() needs the date to compare against — this organ never reads a clock, so the answer is reproducible' };
  const list = Array.isArray(items) ? items : [];
  const late = [], live = [], unknown = [];
  for (const it of list) {
    if (!it || !it.known || !it.due) { unknown.push(it); continue; }
    (new Date(it.due).getTime() < now.getTime() ? late : live).push(it);
  }
  return {
    ok: true, asOf: iso(now), late, live, unknown,
    line: `${late.length} overdue, ${live.length} live, ${unknown.length} unknown as at ${iso(now)}`,
  };
}

export default { RULES, addDays, due, overdue };
