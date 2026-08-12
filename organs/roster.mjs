// roster.mjs — PEOPLE, AND WHY A CV IS NOT EVIDENCE.
/* --- organ
 * name: roster
 * does: who can do what, where a skill is demonstrated and never claimed
 * caps: none
 * --- */
//
// ⚑ YOU CANNOT CLAIM A SKILL, ONLY DEMONSTRATE IT. The same rule as [[earned]], and the same rule as
// unproven gear: `has()` reads demonstrations, and there is no function anywhere in this file that
// takes a skill and marks it true. A roster you can write into is a list of assertions; a roster you
// can only add evidence to is a record.
//
// ⚑ AND A DEMONSTRATION EXPIRES. Not because people forget — because the thing itself moves. A
// demonstration carries the date it happened and the caller supplies "as of", so the answer to "can
// they do this" is always relative to a moment rather than to a stored boolean that quietly rots.

export function roster(name = 'roster') {
  return { name: String(name), people: new Map(), refused: [] };
}

const isRoster = (r) => !!r && r.people instanceof Map;

export function join(r, person) {
  if (!isRoster(r)) return { ok: false, why: 'that is not a roster' };
  const p = String(person || '').trim();
  if (!p) return { ok: false, why: 'a person needs a name' };
  if (!r.people.has(p)) r.people.set(p, []);
  return { ok: true, why: `${p} is on the roster` };
}

/**
 * Record that someone DID something: the skill, when, and what the evidence is.
 *
 * `by` is who witnessed it, and it may not be the person themselves — a self-witnessed demonstration
 * is exactly the self-graded lie that [[earned]] exists to kill, so it is refused here rather than
 * recorded with an asterisk.
 */
export function demonstrated(r, person, skill, opts) {
  // A default parameter does not fire on an explicit null, and null is exactly what a caller reading a
  // missing record hands you. Normalised before destructuring, or the organ throws on its own inputs.
  const { on, evidence, by, expiresInDays = 365 } = (opts && typeof opts === 'object') ? opts : {};
  if (!isRoster(r)) return { ok: false, why: 'that is not a roster' };
  const p = String(person || '').trim(), s = String(skill || '').trim();
  const when = on instanceof Date ? on : new Date(String(on));
  const witness = String(by || '').trim();

  if (!p || !r.people.has(p)) return no(r, `${p || '(nobody)'} is not on the roster`);
  if (!s) return no(r, 'a demonstration needs a named skill');
  if (Number.isNaN(when.getTime())) return no(r, `"${on}" is not a date this happened on`);
  if (!evidence || String(evidence).trim().length < 8) return no(r, 'a demonstration needs evidence somebody could go and check');
  if (!witness) return no(r, 'a demonstration needs a witness — who saw this?');
  if (witness === p) return no(r, `${p} cannot witness their own demonstration — a self-graded skill is a claim wearing a record's clothes`);

  r.people.get(p).push({
    skill: s, on: when.toISOString().slice(0, 10), evidence: String(evidence).trim(), by: witness,
    expires: new Date(when.getTime() + Math.max(1, Number(expiresInDays) || 365) * 86400000).toISOString().slice(0, 10),
  });
  return { ok: true, why: `${p} demonstrated ${s}, witnessed by ${witness}` };
}

function no(r, why) { r.refused.push(why); return { ok: false, why }; }

/**
 * Can this person do this, as at a given date?
 *
 * The date is required. A roster that reads the clock gives a different answer on Tuesday than the
 * same question asked on Monday, and neither is reproducible.
 */
export function has(r, person, skill, asOf) {
  if (!isRoster(r)) return { can: false, why: 'that is not a roster', demonstrations: [] };
  const now = asOf instanceof Date ? asOf : new Date(String(asOf));
  if (Number.isNaN(now.getTime())) return { can: false, why: 'has() needs the date to judge against, so the answer is reproducible' };

  const all = r.people.get(String(person || '').trim()) || [];
  const forSkill = all.filter(d => d.skill === String(skill || '').trim());
  if (!forSkill.length) return { can: false, why: `nothing on record shows ${person} doing ${skill}`, demonstrations: [] };

  const live = forSkill.filter(d => new Date(d.expires).getTime() >= now.getTime());
  if (!live.length) {
    const last = forSkill.map(d => d.on).sort().pop();
    return { can: false, why: `${person} demonstrated ${skill} on ${last}, and that has expired — skills are not a boolean that stays true`, demonstrations: forSkill };
  }
  return {
    can: true,
    why: `${person} demonstrated ${skill} on ${live.map(d => d.on).sort().pop()}, witnessed by ${live[live.length - 1].by}`,
    demonstrations: live,
  };
}

/** Who could do this today — and, said plainly, who used to and no longer counts. */
export function whoCan(r, skill, asOf) {
  if (!isRoster(r)) return { skill, can: [], lapsed: [], line: 'that is not a roster' };
  const can = [], lapsed = [];
  for (const person of r.people.keys()) {
    const h = has(r, person, skill, asOf);
    if (h.can) can.push(person);
    else if (h.demonstrations && h.demonstrations.length) lapsed.push(person);
  }
  return {
    skill, can, lapsed,
    line: `${can.length} can do ${skill}${lapsed.length ? `, ${lapsed.length} lapsed (${lapsed.join(', ')})` : ''}`,
  };
}

export default { roster, join, demonstrated, has, whoCan };
