// artifacts.mjs — THE BUILDS THAT NEVER BECAME REPOS.
//
// si-didy searched 1,396 folded repos and honestly reported nothing, because "The Secret Diary of the
// Void" is a PDF in Downloads and the corpus had never been pointed at a filesystem. The search was
// never wrong; it was never shown the place. A corpus boundary is invisible from inside — which is
// exactly why it has to be stated rather than assumed.
//
// ⚑ NAME AND TITLE ONLY. NEVER CONTENTS. The soul is written to disk and read back for years, so
// swallowing file bodies would turn a memory into an uncontrolled copy of the disk — and the one thing
// worth knowing about a local artifact is that it EXISTS and what it is called. Everything else is a
// path away, and a path is cheaper to hold than a copy.
//
// Pure: no I/O. The caller walks the disk and hands the entries in.

// ⚑ NEVER INDEXED, WHATEVER THE CALLER PASSES. The kernel refuses rather than trusting the scanner to
// have filtered — a list of exclusions maintained in one place, next to the reason, cannot drift out
// of step with a scanner maintained somewhere else.
export const FORBIDDEN = [
  /\.credentials(\.json)?$/i,        // the OAuth credential — must never leave the machine
  /(^|[\\/])seed-vault([\\/]|$)/i,   // the seed's snapshots, local only, never surfaced
  /\.(env|pem|key|p12|pfx|keystore)$/i,
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])\.aws([\\/]|$)/i,
  /id_rsa|id_ed25519/i,
  /(^|[\\/])node_modules([\\/]|$)/i,
  /(^|[\\/])\.git([\\/]|$)/i,
];

// ⚑ "EVERYTHING" IS NOT A CORPUS, IT IS A DISK. The first scan indexed 15,970 files and refused none —
// LinkedIn saved pages, reCAPTCHA frames, screenshots, and every .json inside every cloned project.
// The diary was in there, drowned. A corpus that contains everything answers every question with
// noise, which is indistinguishable from answering none.
//
// So: DOCUMENTS are builds wherever they sit. Notes and pages are builds only where a person SAVES
// them — the top of a root — because nested ones are almost always files inside somebody else's
// project. Images, scripts and data are assets, not builds, and are not indexed at all.
export const DOCUMENTS = /\.(pdf|docx?|pptx?|xlsx?)$/i;
export const SHALLOW = /\.(md|html?|txt|csv)$/i;
export const KEEP = new RegExp(`(${DOCUMENTS.source})|(${SHALLOW.source})`, 'i');

/** Documents count at any depth; notes and pages only at the top of a root. */
export function keepAt(path, depth = 0) {
  const p = String(path == null ? '' : path);
  if (DOCUMENTS.test(p)) return true;
  return SHALLOW.test(p) && depth <= 1;
}

/** May this path be indexed at all? A refusal names WHY, so a surprising gap is explainable. */
export function indexable(path) {
  const p = String(path == null ? '' : path);
  if (!p) return { ok: false, why: 'no path' };
  for (const re of FORBIDDEN) {
    if (re.test(p)) return { ok: false, why: `refused by rule ${re} — secrets and machinery are never indexed` };
  }
  if (!KEEP.test(p)) return { ok: false, why: 'not a kind of file worth remembering as a build' };
  return { ok: true, why: '' };
}

/**
 * A human title for the thing.
 *
 * Metadata wins when it says something, because a document's own Title is what its author called it.
 * Otherwise the filename is un-slugged — `The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf` is already a
 * perfectly good sentence once the hyphens and the version tail come off.
 */
export function titleOf(filename, meta = {}) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const declared = String(m.title || '').trim();
  // ReportLab and Word leave "(unspecified)" and "Untitled" behind; those are absences wearing a value.
  if (declared && !/^\(?unspecified\)?$|^untitled$|^document\d*$|^microsoft word/i.test(declared)) {
    return declared.slice(0, 120);
  }
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s*\bv?\d+(\.\d+)+\b\s*/gi, ' ')     // version tails: v0.3.2
    .replace(/\s+(wrap|final|draft|copy|out)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || String(filename || '').slice(0, 120);
}

/**
 * One artifact as a soul record.
 *
 * Shaped like an estate record on purpose — `canonical`, `url`, `members` — so the existing search
 * finds it with no special case. A second code path for "the other kind of result" is how one of them
 * quietly stops working.
 */
export function record(entry) {
  const e = entry && typeof entry === 'object' ? entry : {};
  const path = String(e.path || '');
  const gate = indexable(path);
  if (!gate.ok) return null;

  const name = String(e.name || path.split(/[\\/]/).pop() || '');
  const title = titleOf(name, e.meta);
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  const author = String((e.meta && e.meta.author) || '').trim().slice(0, 80);

  return {
    id: 'file:' + path.toLowerCase(),
    // The searchable text is title, filename and author — deliberately NOT the file's contents.
    text: [title, name, author, ext].filter(Boolean).join(' · '),
    meta: {
      kind: 'artifact', canonical: title, file: name, path,
      url: 'file:///' + path.replace(/\\/g, '/'),
      ext, author: author || null, at: e.at || null, bytes: e.bytes || 0,
      members: [name], count: 1, live: 0,
    },
  };
}

// ── COLLAPSING VERSIONS ──────────────────────────────────────────────────────────────────────────
//
// The diary is on disk twice — v0.2 and v0.3.2 — and a search that returns both is asking you to work
// out which one is current. The estate index already collapses `<thing>-api/-mcp/-sdk` into one item
// that ships a set; the same move applies here: one WORK, several versions.
//
// ⚑ THE NEWEST IS CANONICAL AND THE OLDER ONES ARE LISTED, NEVER DELETED. A draft you can no longer
// find is a draft that has been destroyed, and the whole reason both copies exist is that you kept
// them. Collapsing is about what leads, not about what survives.

/** A version, as comparable numbers. `v0.3.2` → [0,3,2]; absent → null. */
export function versionOf(name) {
  const m = String(name || '').match(/[._-]v?(\d+(?:\.\d+)+)/i);
  return m ? m[1].split('.').map(Number) : null;
}

/** Compare two versions, newest first. Missing sorts last — an unversioned file is not "version 0". */
export function compareVersions(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  // Padded to equal length first, then compared position by position. Written without index arithmetic
  // because an off-by-one in a bounds check produces one extra iteration over two absent components,
  // which compares zero against zero and changes nothing — invisible to a gate, and still wrong.
  const n = Math.max(a.length, b.length);
  const pad = (v) => Array.from({ length: n }, (_, i) => v[i] || 0);
  const A = pad(a), B = pad(b);
  for (const [i, x] of A.entries()) {
    const d = B[i] - x;
    if (d) return d;
  }
  return 0;
}

/**
 * The stem: what the file is, with everything that says WHICH COPY removed.
 *
 * ⚑ Deliberately conservative. Over-eager stemming merges two genuinely different documents into one
 * and hides the second forever, which is a far worse failure than showing two versions of one thing.
 */
export function stemOf(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[._-]v?\d+(?:\.\d+)+/gi, '')          // v0.3.2, _1.2
    .replace(/[\s._-]*\((\d+)\)$/, '')              // "report (1)"
    .replace(/[\s._-]*(copy|final|draft|wrap|out|latest|new|old)\b/gi, '')
    .replace(/[\s._-]*\d{4}-\d{2}(-\d{2})?$/, '')   // a trailing date stamp
    .replace(/[-_\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Collapse records that are versions of one work.
 *
 * Only files sharing a stem AND an extension collapse — a PDF and a DOCX of the same name are usually
 * a source and its export, and which one you want depends on what you are doing.
 */
export function collapse(records) {
  const list = (Array.isArray(records) ? records : []).filter(r => r && r.meta);
  const groups = new Map();
  for (const r of list) {
    const stem = stemOf(r.meta.file);
    // ⚑ SCOPED TO THE FOLDER. Without this, every README.md on the disk shares a stem and collapses
    // into one — and the second, third and hundredth project's README vanish behind the first. Versions
    // of one work sit together; two files that merely share a name do not. Measured: unscoped folded
    // 78% of the corpus away, which is not folding, it is losing things.
    const dir = String(r.meta.path || '').slice(0, -String(r.meta.file || '').length).toLowerCase();
    const key = stem ? dir + '|' + stem + '|' + r.meta.ext : 'x' + groups.size;   // no stem ⇒ never grouped
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const out = [];
  for (const members of groups.values()) {
    if (members.length === 1) { out.push(members[0]); continue; }

    // Newest first: by version when both carry one, otherwise by modified date.
    const sorted = [...members].sort((a, b) =>
      compareVersions(versionOf(a.meta.file), versionOf(b.meta.file))
      || String(b.meta.at || '').localeCompare(String(a.meta.at || '')));

    const lead = sorted[0], rest = sorted.slice(1);
    out.push({
      ...lead,
      // The other versions stay searchable by name — the point is which one LEADS, not which survive.
      text: [lead.text, ...rest.map(r => r.meta.file)].join(' · '),
      meta: {
        ...lead.meta,
        versions: sorted.map(r => ({ file: r.meta.file, path: r.meta.path, at: r.meta.at, version: versionOf(r.meta.file) })),
        count: sorted.length,
        members: sorted.map(r => r.meta.file),
        superseded: rest.map(r => r.meta.path),
      },
    });
  }
  return out;
}

/** Everything a scan yields, with what it refused stated rather than silently dropped. */
export function fromScan(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const found = [], refused = [];
  for (const e of list) {
    const r = record(e);
    if (r) found.push(r);
    else refused.push({ path: e && e.path, why: indexable(e && e.path).why });
  }
  const records = collapse(found);
  const collapsed = found.length - records.length;
  const byExt = {};
  for (const r of records) byExt[r.meta.ext] = (byExt[r.meta.ext] || 0) + 1;
  return {
    records, refused, byExt, seen: found.length, collapsed,
    line: `${records.length} artifacts indexed from ${found.length} files (${collapsed} older versions folded in), `
        + `${refused.length} refused — names and titles only, never contents`,
  };
}

export default { FORBIDDEN, KEEP, indexable, titleOf, record, fromScan };
