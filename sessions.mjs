// sessions.mjs — LEARN FROM THE WORK, NOT FROM THE CHAT WINDOW.
//
// si-didy has every learning organ it needs — episodes, a dream cycle, a shadow index — and its dream
// log reads `merged 0 · transitive 0 · generalized 0 · rules []`. Not because the organs are broken:
// because they were fed 13 turns, nearly all of them smoke-test probes. Meanwhile 150MB of real
// sessions sat on disk, unread. The loop was wired to the wrong input.
//
// This is the offramp pointed inward: a transcript is a DEAD export, and the point is not to store it
// but to compress it into the few things worth carrying forward.
//
// ⚑ AND THE HARD PART IS DECIDING WHOSE WORDS THEY ARE. A transcript is full of text that LOOKS like
// the user and is not: system reminders injected into user turns, tool results delivered as user
// messages, compaction summaries the assistant wrote about itself. Learning from those would teach
// si-didy its own echo — the most expensive possible mistake for a memory that compounds. Every rule
// below exists to keep one of them out.
//
// Pure: no I/O, no clock, no randomness. The caller streams lines in and supplies the dates.

// ── WHOSE WORDS ARE THESE? ───────────────────────────────────────────────────────────────────────

// ⚑ THE PRINCIPLED FILTER IS A FIELD, NOT A PATTERN. Entries carry `origin.kind`, and a background
// task reporting back is `task-notification` while a person typing is `human`. Matching on the field
// catches every machine origin including ones not invented yet; a regex list catches only the shapes
// you already lost to. The patterns below remain for injections that ARE tagged human — text the app
// puts in the user's mouth — which the field cannot distinguish.
export const MACHINE_ORIGIN = (entry) => {
  const k = entry && entry.origin && entry.origin.kind;
  return typeof k === 'string' && k !== 'human';
};

// Text the harness injects INTO a user turn. It arrives wearing the user's role and is not the user.
const INJECTED = [
  /^<system-reminder>/i,
  /^<command-name>/i,
  /^<local-command-stdout>/i,
  /^<task-notification>/i,
  /^\[SYSTEM NOTIFICATION/i,
  /^Caveat: The messages below were generated/i,
  /^This session is being continued from a previous conversation/i,
  /^\[Request interrupted/i,
  /^My computer went to sleep while you were working/i,
  /^The user (sent|opened|doesn't want)/i,
  /^\s*$/,
];

/** The text of an entry, flattening content blocks — or '' when it carries no plain text at all. */
export function textOf(entry) {
  const c = entry && entry.message ? entry.message.content : null;
  if (typeof c === 'string') return c.trim();
  if (!Array.isArray(c)) return '';
  // ⚑ TOOL RESULTS ARE NOT SPEECH. They ride in user-role messages, and a transcript is mostly them.
  // Only `text` blocks are words; anything else is machinery reporting to itself.
  return c.filter(b => b && b.type === 'text').map(b => String(b.text || '')).join('\n').trim();
}

/**
 * Is this the user actually speaking?
 *
 * Deliberately strict. A false positive here does not produce a slightly-worse memory — it teaches
 * si-didy that its own summaries and its own tool output are things Simon said.
 */
export function isUser(entry) {
  if (!entry || entry.type !== 'user') return false;
  if (entry.isMeta || entry.isCompactSummary) return false;
  if (entry.isSidechain) return false;                    // a subagent's conversation, not this one
  if (entry.toolUseResult !== undefined) return false;    // a tool returning, wearing the user's role
  if (entry.userType && entry.userType !== 'external') return false;
  if (MACHINE_ORIGIN(entry)) return false;                // a background task reporting, not a person
  const t = textOf(entry);
  if (!t) return false;
  if (INJECTED.some(re => re.test(t))) return false;
  // A user turn carrying a tool_result block is a tool return however much text rides along with it.
  const c = entry.message && entry.message.content;
  if (Array.isArray(c) && c.some(b => b && b.type === 'tool_result')) return false;
  return true;
}

// ── WHAT KIND OF THING DID THEY SAY? ─────────────────────────────────────────────────────────────
//
// Not sentiment, and not a score. Three kinds that change what si-didy should DO, and everything else
// is left as a plain ask rather than forced into a bucket it does not fit.

export const KINDS = ['correction', 'standing-rule', 'ask'];

const CORRECTION = /\b(no|nope|wrong|not what|isn'?t what|stop|don'?t|doesn'?t|didn'?t|never|instead|actually|again|still|why (are|is|aren'?t|isn'?t)|you (keep|said|missed|forgot))\b/i;
const STANDING = /\b(always|never|every ?(time|build|session)|from now on|remember to|make sure|each time|going forward)\b/i;

/**
 * ⚑ A CORRECTION IS THE MOST VALUABLE SENTENCE IN A TRANSCRIPT and the easiest to lose. It is the one
 * place the user tells you the model of the work in their head differs from yours. Labelled, never
 * scored — "73% negative sentiment" would be useless where "he said 'you keep stopping doing it'" is
 * actionable.
 */
export function classify(text) {
  const t = String(text || '');
  if (STANDING.test(t)) return 'standing-rule';
  if (CORRECTION.test(t)) return 'correction';
  return 'ask';
}

// ── SECRETS NEVER LEAVE THE TRANSCRIPT ───────────────────────────────────────────────────────────
//
// The soul is written to disk and read back for years. A transcript can contain a pasted token; a
// memory that swallowed one would hold it far longer than the session that leaked it.
const SECRET = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, '«redacted-key»'],
  [/gh[pousr]_[A-Za-z0-9]{16,}/g, '«redacted-token»'],
  [/\bBearer\s+[A-Za-z0-9._-]{16,}/gi, 'Bearer «redacted»'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./g, '«redacted-jwt»'],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '«email»'],
];
export function redact(text) {
  let t = String(text == null ? '' : text);
  for (const [re, to] of SECRET) t = t.replace(re, to);
  return t;
}

// ── THE EXTRACT ──────────────────────────────────────────────────────────────────────────────────

/**
 * One turn, reduced to what is worth carrying: who, when, what kind, and the words — redacted, and
 * capped, because a memory of a 17,000-character paste is not a memory, it is a copy.
 */
export function turn(entry, { max = 600 } = {}) {
  if (!isUser(entry)) return null;
  const raw = redact(textOf(entry));
  const text = raw.length > max ? raw.slice(0, max).replace(/\s+\S*$/, '') + '…' : raw;
  return {
    at: String(entry.timestamp || '').slice(0, 10) || null,
    session: String(entry.sessionId || '').slice(0, 8) || null,
    kind: classify(raw),
    text,
    long: raw.length > max,
  };
}

/**
 * What a run of turns amounts to.
 *
 * ⚑ RECURRENCE IS THE SIGNAL. One request is a task; the same request across DIFFERENT sessions is a
 * standing expectation that keeps being missed — which is exactly the thing that got lost. Counted by
 * distinct session, never by repetition, so a user asking twice in one sitting is not mistaken for a
 * pattern.
 */
export function digest(turns) {
  const list = (Array.isArray(turns) ? turns : []).filter(Boolean);
  const byKind = {};
  for (const k of KINDS) byKind[k] = 0;
  for (const t of list) byKind[t.kind] = (byKind[t.kind] || 0) + 1;

  const seen = new Map();
  for (const t of list) {
    const key = gist(t.text);
    if (!key) continue;
    const e = seen.get(key) || { gist: key, sessions: new Set(), kinds: new Set(), example: t.text };
    e.sessions.add(t.session);
    e.kinds.add(t.kind);
    if (t.text.length < e.example.length) e.example = t.text;   // the tersest phrasing reads best
    seen.set(key, e);
  }

  const recurring = [...seen.values()]
    .map(e => ({ gist: e.gist, sessions: e.sessions.size, kinds: [...e.kinds], example: e.example }))
    .filter(e => e.sessions > 1)
    .sort((a, b) => b.sessions - a.sessions || a.gist.localeCompare(b.gist));

  return {
    turns: list.length, byKind,
    sessions: new Set(list.map(t => t.session)).size,
    recurring,
    corrections: list.filter(t => t.kind === 'correction'),
    line: `${list.length} turns across ${new Set(list.map(t => t.session)).size} sessions · `
        + `${byKind.correction || 0} corrections · ${byKind['standing-rule'] || 0} standing rules · `
        + `${recurring.length} asked in more than one session`,
  };
}

// The gist of a turn: content words, sorted and deduped, so two phrasings of one request collide.
// Crude on purpose — a cleverer key would collapse things that are not the same request.
const STOP = new Set(['the', 'and', 'for', 'you', 'can', 'get', 'got', 'this', 'that', 'with', 'have',
  'its', 'was', 'are', 'but', 'not', 'all', 'now', 'just', 'need', 'want', 'make', 'let', 'yeh', 'yes',
  'ok', 'okay', 'dude', 'mate', 'ffs', 'omg', 'lets', 'were', 'been', 'from', 'into', 'them', 'they']);
// TWO content words is a request — "build search", "push it". Requiring three returned an empty gist
// for most short asks, and empty gists compare EQUAL, so unrelated requests silently collided into one
// recurring pattern. A key that collapses everything is worse than no key.
export function gist(text, { min = 2 } = {}) {
  const w = String(text || '').toLowerCase().match(/[a-z][a-z-]{2,}/g) || [];
  const keep = [...new Set(w.filter(x => !STOP.has(x)))].sort();
  return keep.length >= min ? keep.slice(0, 8).join(' ') : '';
}

export default { textOf, isUser, classify, redact, turn, digest, gist, KINDS };
