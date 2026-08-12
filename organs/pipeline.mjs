// pipeline.mjs — SALES, WITHOUT THE PART WHERE EVERYONE LIES TO THEMSELVES.
/* --- organ
 * name: pipeline
 * does: a deal pipeline whose forecast cannot exceed its evidence
 * caps: none
 * --- */
//
// ⚑ A DEAL CANNOT ENTER A STAGE IT HAS NOT EARNED. Every CRM lets you drag a card to "Commit" because
// you feel good about the call. That is why forecasts are fiction: the pipeline records confidence and
// then reports it as though it were evidence. Here each stage has ENTRY EVIDENCE, and a deal without
// it is refused — the same rule as unproven gear, applied to money that has not arrived.
//
// ⚑ AND THE FORECAST IS BOUNDED BY WHAT IS EVIDENCED, NOT BY WHAT IS HOPED. `forecast()` reports the
// committed total and, separately and always, what was excluded and why. A single number with the
// exclusions removed is the thing that makes a board meeting go wrong six weeks later.

// Ordered. Each stage names what must be TRUE, not what must be felt.
export const STAGES = [
  { id: 'lead',      name: 'Lead',      needs: [],                          is: 'somebody exists who might want this' },
  { id: 'qualified', name: 'Qualified', needs: ['contact'],                 is: 'a named human who answers' },
  { id: 'scoped',    name: 'Scoped',    needs: ['contact', 'amount'],       is: 'a number both sides have seen' },
  { id: 'proposed',  name: 'Proposed',  needs: ['contact', 'amount', 'sent'], is: 'something was actually sent' },
  { id: 'commit',    name: 'Commit',    needs: ['contact', 'amount', 'sent', 'date'], is: 'they named a date' },
  { id: 'won',       name: 'Won',       needs: ['contact', 'amount', 'sent', 'date', 'signed'], is: 'signed' },
  { id: 'lost',      name: 'Lost',      needs: ['reason'],                  is: 'and we wrote down why' },
];
export const stageOf = (id) => STAGES.find(s => s.id === id) || null;

export function deal(name, facts = {}) {
  return { name: String(name || '').trim(), stage: 'lead', facts: { ...facts }, history: ['lead'], refused: [] };
}

export function learn(d, key, value) {
  if (value === undefined || value === null || value === '') return { ok: false, why: `"${key}" was empty, so nothing was learned` };
  d.facts[key] = value;
  return { ok: true, why: `${d.name}: ${key} recorded` };
}

/**
 * Move a deal to a stage, if the evidence for that stage exists.
 *
 * Moving BACKWARDS is always allowed and needs nothing: discovering a deal is worse than you thought
 * is information, and a pipeline that makes it hard to record is a pipeline that lies upward.
 */
export function moveTo(d, stageId) {
  const s = stageOf(stageId);
  if (!s) return refuse(d, `there is no stage called "${stageId}"`);

  const from = STAGES.findIndex(x => x.id === d.stage), to = STAGES.findIndex(x => x.id === s.id);
  const missing = s.needs.filter(k => d.facts[k] === undefined || d.facts[k] === null || d.facts[k] === '');

  if (to > from && missing.length) {
    return refuse(d, `${s.name} means «${s.is}» — missing ${missing.join(', ')}. A deal cannot enter a stage it has not earned.`);
  }
  d.stage = s.id;
  d.history.push(s.id);
  return { ok: true, why: `${d.name} → ${s.name}` };
}

function refuse(d, why) { d.refused.push(why); return { ok: false, why }; }

/**
 * The forecast, with its exclusions stated in the same breath.
 *
 * `committed` counts only deals at commit or won AND carrying an amount. Everything left out is
 * listed with the reason, because the excluded pile is the part a forecast usually hides.
 */
export function forecast(deals) {
  const list = Array.isArray(deals) ? deals : [];
  let committed = 0, won = 0;
  const counted = [], excluded = [];

  for (const d of list) {
    const amt = Number(d && d.facts ? d.facts.amount : NaN);
    if (!d || !stageOf(d.stage)) { excluded.push({ name: d && d.name, why: 'not a deal in a known stage' }); continue; }
    if (d.stage === 'won') {
      if (Number.isFinite(amt)) { won += amt; counted.push({ name: d.name, amount: amt, stage: 'won' }); }
      else excluded.push({ name: d.name, why: 'won, but carries no amount — a win with no number is a story' });
      continue;
    }
    if (d.stage !== 'commit') { excluded.push({ name: d.name, why: `at ${d.stage}, which is short of commit` }); continue; }
    if (!Number.isFinite(amt)) { excluded.push({ name: d.name, why: 'at commit with no amount, which cannot be forecast' }); continue; }
    committed += amt; counted.push({ name: d.name, amount: amt, stage: 'commit' });
  }

  return {
    won, committed, total: won + committed,
    counted, excluded,
    // The sentence, with the denominator in it. A forecast that reports only its numerator is the
    // oldest trick in the book and it is usually not even deliberate.
    line: `${counted.length} of ${list.length} deals counted — ${excluded.length} excluded and listed. `
        + `Won ${won}, committed ${committed}.`,
  };
}

export default { STAGES, stageOf, deal, learn, moveTo, forecast };
