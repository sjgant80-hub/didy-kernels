// organcheck.mjs — THE RIGHT INSTRUMENT FOR THE MATERIAL.
//
// `skill.mjs` reads SKILL.md: Markdown prose an agent is told to follow, where the TEXT is the
// executable and the honest question is "does the prose ask for more than it declared". Pointed at
// JavaScript it produces nonsense — `capability.mjs` was reported as reaching for the clipboard
// because the string 'clipboard' appears in a list of resource names. Declaring clipboard access to
// silence that would be a lie told to a gate, which is worse than having no gate.
//
// So this is the same question asked with an instrument that fits: an organ declares its capabilities
// in a block at the top of the file, and what it ACTUALLY reaches for is found by looking for the APIs
// that genuinely carry that capability — `node:fs`, `fetch(`, `process.env`, `child_process` — after
// comments and string literals have been removed, so naming a thing is never mistaken for using it.
//
// ⚑ THE PROPERTY THAT MATTERS: an organ is admitted because it was READ, never because it arrived
// claiming to be fine. `admit()` takes source text and returns a verdict. There is no parameter
// through which a caller can pass "proven", which is what makes the equip endpoint safe by
// construction rather than by remembering to check.
import { RESOURCES, rank } from './organs/capability.mjs';

// The four levels, named here so a declaration can be validated by MEMBERSHIP rather than by ranking.
export const LEVELS = ['none', 'read', 'write', 'admin'];

// ── STRIP WHAT IS NOT CODE ───────────────────────────────────────────────────────────────────────
//
// The whole false-positive class lives in comments and string literals. A file that mentions `fetch(`
// in a comment explaining why it does NOT fetch must not be reported as fetching.
export function code(src) {
  let s = String(src == null ? '' : src);
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');           // block comments
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');       // line comments, keeping http:// intact

  // ⚑ MODULE SPECIFIERS ARE STRING LITERALS, AND THEY ARE THE STRONGEST SIGNAL THERE IS.
  // Stripping strings to kill false positives would also delete `from 'node:fs'` — the single most
  // load-bearing fact about a file — and the scanner would then pass an organ that imports the whole
  // filesystem. So specifiers are lifted out BEFORE the strings go, and appended back afterwards.
  const specs = [...s.matchAll(/(?:\bfrom|\brequire\s*\(|\bimport\s*\()\s*['"]([^'"\n]+)['"]/g)].map(m => m[1]);

  s = s.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``');    // template literals
  s = s.replace(/'(?:\\.|[^'\\\n])*'/g, "''");       // single-quoted
  s = s.replace(/"(?:\\.|[^"\\\n])*"/g, '""');       // double-quoted
  return specs.length ? s + '\n/*specifiers*/ ' + specs.join(' ') : s;
}

// ── WHAT THIS CODE ACTUALLY REACHES FOR ──────────────────────────────────────────────────────────
//
// Each signal names the API that carries the capability, so every finding can be pointed at a line
// rather than argued about. Precise by design: `navigator.clipboard` is clipboard access, the word
// "clipboard" is not.
export const SIGNALS = [
  { resource: 'shell', level: 'admin', label: 'runs another program',
    re: /\bchild_process\b|\bexecSync\b|\bexecFileSync\b|\bspawnSync\b|\bspawn\s*\(|\bexec\s*\(/ },
  { resource: 'skill_invoke', level: 'write', label: 'builds and runs code at runtime',
    re: /\beval\s*\(|\bnew\s+Function\s*\(|\bimport\s*\(/ },
  { resource: 'filesystem', level: 'write', label: 'writes to disk',
    re: /\bwriteFileSync\b|\bwriteFile\b|\bappendFileSync\b|\bmkdirSync\b|\brmSync\b|\bunlinkSync\b|\bcreateWriteStream\b/ },
  { resource: 'filesystem', level: 'read', label: 'reads from disk',
    re: /\bnode:fs\b|\breadFileSync\b|\breadFile\b|\breaddirSync\b|\bexistsSync\b|\bcreateReadStream\b|\bstatSync\b/ },
  { resource: 'network', level: 'write', label: 'opens a network connection',
    re: /\bnode:(net|http|https|dgram)\b|\bcreateServer\b|\bnew\s+WebSocket\b|\bRTCPeerConnection\b|\bnavigator\.sendBeacon\b/ },
  { resource: 'network', level: 'read', label: 'fetches over the network',
    re: /\bfetch\s*\(|\bXMLHttpRequest\b|\bEventSource\b/ },
  { resource: 'env', level: 'read', label: 'reads environment variables',
    re: /\bprocess\.env\b|\bimport\.meta\.env\b/ },
  { resource: 'clipboard', level: 'write', label: 'writes the clipboard',
    re: /\bnavigator\.clipboard\b|\bdocument\.execCommand\s*\(\s*''\s*\)|\bpbcopy\b/ },
  { resource: 'browser', level: 'write', label: 'drives a browser',
    re: /\bpuppeteer\b|\bplaywright\b|\bwebdriver\b/ },
  { resource: 'database', level: 'write', label: 'uses a database',
    re: /\bindexedDB\b|\bopenDatabase\b|\bnew\s+Database\b|\bbetter-sqlite3\b/ },
];

/** Every signal the CODE fires, with the fragment that fired it. */
export function reaches(src) {
  const c = code(src);
  const out = [];
  for (const s of SIGNALS) {
    const m = c.match(s.re);
    if (m) out.push({ resource: s.resource, level: s.level, label: s.label, evidence: String(m[0]).trim().slice(0, 60) });
  }
  return out;
}

// ── THE DECLARATION ──────────────────────────────────────────────────────────────────────────────
//
// It lives in the organ file itself, in a block comment, because a declaration in a sidecar drifts
// from the code the first time someone edits one and not the other. Deliberately the same shape as
// SKILL.md frontmatter so an organ and a skill are declaring in one vocabulary.
//
//   /* --- organ
//    * name: capability
//    * does: the capability lattice
//    * caps: filesystem:read, network:read
//    * --- */
//
// `caps:` absent entirely is NOT the same as `caps: none`. The first is an organ nobody has declared
// and it is refused; the second is a positive claim to touch nothing, and it is checkable.
export function declaration(src) {
  const m = String(src == null ? '' : src).match(/\/\*\s*---\s*organ\s*([\s\S]*?)---\s*\*\//);
  if (!m) return { ok: false, why: 'no organ declaration block', fields: {} };

  const fields = {};
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/^\s*\*?\s?/, '').trim();
    if (!line) continue;
    const kv = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/i);
    if (!kv) return { ok: false, why: `line not understood: «${line.slice(0, 60)}»`, fields };
    fields[kv[1].toLowerCase()] = kv[2].trim();
  }

  const caps = {};
  const problems = [];
  const raw = fields.caps === undefined ? null : fields.caps;
  if (raw !== null && raw.toLowerCase() !== 'none') {
    for (const part of raw.split(',').map(s => s.trim()).filter(Boolean)) {
      const p = part.split(':').map(s => s.trim());
      if (p.length !== 2) { problems.push(`«${part}» is not resource:level`); continue; }
      if (!RESOURCES.includes(p[0])) { problems.push(`«${p[0]}» is not a resource`); continue; }
      // ⚑ Checked against the list, NOT via rank(). `rank` returns zero for anything it does not
      // recognise, so a negative-rank test never fires, and `filesystem:banana` would be stored as a
      // real capability that merely ranks as harmless — a typo silently becoming a declaration.
      if (!LEVELS.includes(p[1])) { problems.push(`«${p[1]}» is not a level`); continue; }
      caps[p[0]] = p[1];
    }
  }
  return {
    ok: true, why: '', fields, caps, problems,
    declaredNothing: raw !== null && raw.toLowerCase() === 'none',
    hasCaps: raw !== null,
  };
}

// ── THE VERDICT ──────────────────────────────────────────────────────────────────────────────────

/**
 * Read an organ and decide whether it may be equipped.
 *
 * Admitted only when everything the code reaches for was declared, and — when a grant is supplied —
 * everything declared fits inside it. Every failure is NAMED with the fragment that caused it, so the
 * author can fix the declaration or the code rather than argue with a score.
 */
export function admit(src, runningUnder = null, name = null) {
  const d = declaration(src);
  const asks = reaches(src);
  const problems = [];

  if (!d.ok) problems.push({ kind: 'undeclared', what: 'declaration', why: d.why });
  for (const p of d.problems || []) problems.push({ kind: 'malformed', what: 'caps', why: p });
  if (d.ok && !d.fields.name) problems.push({ kind: 'malformed', what: 'name', why: 'an organ with no name cannot be pinned to a verdict' });
  if (d.ok && !d.fields.does) problems.push({ kind: 'malformed', what: 'does', why: 'nothing tells a person what this is for' });
  if (d.ok && !d.hasCaps) problems.push({ kind: 'malformed', what: 'caps', why: 'no caps line — an organ that declares nothing has not declared "nothing"' });

  const caps = d.caps || {};
  const undeclared = [];
  for (const a of asks) {
    const have = caps[a.resource];
    if (rank(have || 'none') < rank(a.level)) {
      undeclared.push({ ...a, declaredAs: have || 'nothing' });
      problems.push({ kind: 'undeclared', what: `${a.resource}:${a.level}`,
        why: `it ${a.label} — declared ${have || 'nothing'} — «${a.evidence}»` });
    }
  }

  // ⚑ OVER-DECLARING IS ALSO A DEFECT. An organ that claims the shell and never touches it drags that
  // capability into every build it joins, and least privilege lost to carelessness is lost either way.
  const unused = [];
  for (const [r, lvl] of Object.entries(caps)) {
    if (!asks.some(a => a.resource === r && rank(a.level) >= rank(lvl))) {
      unused.push({ resource: r, level: lvl });
      problems.push({ kind: 'over_declared', what: `${r}:${lvl}`,
        why: 'declared but nothing in the code reaches for it — drop it, or the build inherits it for nothing' });
    }
  }

  const outsideGrant = [];
  if (runningUnder) {
    for (const [r, lvl] of Object.entries(caps)) {
      if (rank(runningUnder.caps[r]) < rank(lvl)) {
        outsideGrant.push({ resource: r, level: lvl, allowed: runningUnder.caps[r] });
        problems.push({ kind: 'over_grant', what: `${r}:${lvl}`, why: `the character holds ${runningUnder.caps[r]}` });
      }
    }
  }

  const who = (d.fields && d.fields.name) || name || '(unnamed)';
  const admitted = problems.length === 0;
  return {
    name: who, does: (d.fields && d.fields.does) || null,
    declared: caps, reaches: asks, undeclared, unused, outsideGrant, problems, admitted,
    verdict: admitted
      ? `ADMITTED — everything ${who} reaches for, it declared${asks.length ? '' : ', and it reaches for nothing'}.`
      : `REFUSED — ${who} has ${problems.length} problem${problems.length === 1 ? '' : 's'}, listed in full below.`,
  };
}

export default { code, SIGNALS, reaches, declaration, admit };
