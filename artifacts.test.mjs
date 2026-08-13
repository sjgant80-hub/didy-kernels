// artifacts.test.mjs — PROOF-OF-PLAY for indexing local builds.
//
// Two ways this goes wrong, and both are worse than the gap it was built to close. It can swallow a
// secret — the soul is written to disk and read back for years, so an indexed credential outlives the
// leak that produced it. Or it can index everything, which is not a corpus but a copy of a disk, and a
// corpus containing everything answers every question with noise.
import { FORBIDDEN, DOCUMENTS, SHALLOW, indexable, keepAt, titleOf, record, fromScan, collapse, stemOf, versionOf, compareVersions } from './artifacts.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const D = 'C:\\Users\\sjgan\\Downloads\\';

console.log('\n=== §1 · ⚑ SECRETS ARE NEVER INDEXED ===');
{
  const secrets = [
    'C:\\Users\\sjgan\\.claude\\.credentials.json',
    'C:\\Users\\sjgan\\seed-vault\\before-Y.md',
    'C:\\proj\\.env',
    'C:\\certs\\server.pem',
    'C:\\keys\\deploy.key',
    'C:\\Users\\sjgan\\.ssh\\id_rsa',
    'C:\\Users\\sjgan\\.aws\\credentials',
  ];
  let allRefused = true;
  for (const s of secrets) if (indexable(s).ok) { allRefused = false; console.log(`    (INDEXED: ${s})`); }
  ok(allRefused, '⚑ credentials, the seed vault, .env, keys and ssh/aws are ALL refused');
  ok(/secrets and machinery are never indexed/.test(indexable('C:\\a\\.env').why), 'and the refusal says why');
  ok(!indexable(D + 'x.md').ok === false, 'while an ordinary document is allowed');
  ok(FORBIDDEN.length >= 7, 'the forbidden list is held in one place, next to its reason');
}

console.log('\n=== §2 · ⚑ CONTENTS ARE NEVER STORED, ONLY NAMES AND TITLES ===');
{
  const r = record({
    path: D + 'The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf',
    name: 'The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf',
    meta: { title: 'INIT · the map', author: 'ai-native-solutions' },
    bytes: 236913, at: '2026-06-29',
  });
  ok(!!r, 'a real document produces a record');
  ok(r.text.length < 200, '⚑ the searchable text is SHORT — a title and a filename, never a document body');
  ok(r.text.includes('The-Secret-Diary-of-the-Void'), 'and the FILENAME is in it, which was the only thing that ever said what this file was');
  ok(r.meta.kind === 'artifact', 'it is marked as an artifact');
  ok(r.meta.url.startsWith('file:///'), 'with a path you can actually open');
  ok(r.meta.canonical === 'INIT · the map', 'the declared title wins when there is one');
  ok(r.meta.count === 1 && Array.isArray(r.meta.members), '⚑ shaped like an estate record, so the existing search needs no special case');
}

console.log('\n=== §3 · ⚑ "EVERYTHING" IS NOT A CORPUS ===');
{
  // The first scan took 15,970 files and refused none — LinkedIn saves, reCAPTCHA frames, screenshots.
  // The diary was in there and drowned.
  ok(!indexable(D + 'post-ai-image-793.png').ok, 'images are assets, not builds');
  ok(!indexable('C:\\proj\\bundle.js').ok, 'scripts are not builds');
  ok(!indexable('C:\\proj\\package.json').ok, 'and neither is project data');
  ok(indexable(D + 'deck.pptx').ok, 'while a deck is');

  // Documents anywhere; notes and pages only where a person actually saves them.
  ok(keepAt(D + 'sub\\deep\\report.pdf', 3) === true, '⚑ a DOCUMENT counts at any depth');
  ok(keepAt(D + 'notes.md', 0) === true, 'a note counts at the top of a root');
  ok(keepAt(D + 'cloned-project\\src\\README.md', 3) === false,
     '⚑ but a README three levels down is a file inside somebody else\'s project, not a build of yours');
  ok(DOCUMENTS.test('a.docx') && SHALLOW.test('a.md'), 'the two classes are named separately, not blended');
}

console.log('\n=== §4 · the title is what a person would call it ===');
{
  ok(titleOf('The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf') === 'The Secret Diary of the Void',
     '⚑ un-slugged, version tail and "wrap" removed — the filename was already a good sentence');
  ok(titleOf('x.pdf', { title: 'INIT · the map' }) === 'INIT · the map', 'a declared title wins');
  ok(titleOf('my-report.pdf', { title: '(unspecified)' }) === 'my report',
     '⚑ "(unspecified)" is an ABSENCE wearing a value — the filename is better than it');
  ok(titleOf('my-report.pdf', { title: 'Untitled' }) === 'my report', 'and so is "Untitled"');
  ok(titleOf('brief.docx', { title: 'Microsoft Word - brief.doc' }) === 'brief', 'and Word\'s own placeholder');
  ok(titleOf('') === '', 'nothing in, nothing out');
  ok(titleOf('a-b-c-v1.2.3-final.md') === 'a b c', 'version and "final" are noise, not name');
}

console.log('\n=== §5 · a scan reports what it turned away ===');
{
  const s = fromScan([
    { path: D + 'diary.pdf', name: 'diary.pdf' },
    { path: 'C:\\a\\.env', name: '.env' },
    { path: D + 'photo.png', name: 'photo.png' },
  ]);
  ok(s.records.length === 1, 'one of three is indexed');
  ok(s.refused.length === 2, '⚑ and the other two are REPORTED, not silently dropped');
  ok(s.refused.every(r => r.why), 'each with its reason');
  ok(/names and titles only, never contents/.test(s.line), 'and the line states the bound every time');
  ok(JSON.stringify(s.byExt) === '{"pdf":1}', 'the type breakdown counts only what was kept');
  ok(fromScan(null).records.length === 0, 'a non-list scans to nothing');
}

console.log('\n=== §7 · the boundaries, and every field carried ===');
{
  // Depth 1 is "saved in a folder in Downloads" — still a place a person puts their own work. Depth 2
  // is inside something. An off-by-one here silently loses a whole layer of real builds.
  ok(keepAt(D + 'notes.md', 1) === true, '⚑ a note ONE folder deep is still yours — the boundary is <= 1');
  ok(keepAt(D + 'proj\\src\\notes.md', 2) === false, 'two deep is inside somebody else\'s project');
  ok(keepAt(D + 'proj\\src\\deep\\report.pdf', 5) === true, 'while a document is a document at any depth');

  // A filename that reduces to nothing under un-slugging must still leave a usable name.
  ok(titleOf('v1.2.3.pdf').length > 0, '⚑ a filename that strips to nothing falls back to itself, never to blank');
  ok(titleOf('2026.pdf').length > 0, 'and so does a bare number');

  // Every field on the record is load-bearing — a search result you cannot open or date is half a result.
  const full = record({ path: D + 'a.pdf', name: 'a.pdf', meta: { author: 'ai-native-solutions' }, at: '2026-06-29', bytes: 1234 });
  ok(full.meta.author === 'ai-native-solutions', '⚑ the author is carried, not dropped');
  ok(full.text.includes('ai-native-solutions'), 'and is searchable — it is often the only estate marker on a file');
  ok(full.meta.at === '2026-06-29' && full.meta.bytes === 1234, 'the date and size are carried');

  const bare = record({ path: D + 'b.pdf' });
  ok(bare.meta.file === 'b.pdf', '⚑ with no name given, it is derived from the path rather than left empty');
  ok(bare.meta.author === null, 'an absent author reports null');
  ok(bare.meta.at === null && bare.meta.bytes === 0, 'and an absent date and size report null and zero');
}

console.log('\n=== §8 · ⚑ VERSIONS COLLAPSE TO ONE WORK, NEWEST LEADING ===');
{
  const f = (name, at) => ({ path: D + name, name, at });
  const s = fromScan([
    f('The-Secret-Diary-of-the-Void-v0.2.pdf', '2026-06-01'),
    f('The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf', '2026-06-29'),
  ]);
  ok(s.records.length === 1, '⚑ two versions of one work are ONE result, not a puzzle for the reader');
  ok(s.collapsed === 1 && s.seen === 2, 'and the fold is reported, not silent');
  ok(/1 older versions folded in/.test(s.line), 'the line says how many were folded');

  const r = s.records[0];
  ok(/v0\.3\.2/.test(r.meta.file), '⚑ the NEWEST version leads');
  ok(r.meta.versions.length === 2, 'both versions are listed');
  ok(r.meta.superseded.length === 1 && /v0\.2/.test(r.meta.superseded[0]),
     '⚑ and the older one is SUPERSEDED, never deleted — a draft you cannot find has been destroyed');
  ok(r.text.includes('v0.2'), 'the older filename stays searchable, so asking for v0.2 by name still finds it');

  // Order of discovery must not decide which leads.
  const flipped = fromScan([f('a-v0.3.2.pdf', '2026-01-01'), f('a-v0.2.pdf', '2026-12-01')]);
  ok(/v0\.3\.2/.test(flipped.records[0].meta.file), 'a higher version beats a newer date — the version is the stronger claim');
  const undated = fromScan([f('b-wrap.pdf', '2026-01-01'), f('b-final.pdf', '2026-09-01')]);
  ok(undated.records.length === 1 && /final/.test(undated.records[0].meta.file),
     'with no versions at all, the newest file leads');
}

console.log('\n=== §9 · ⚑ COLLAPSING MUST NOT MERGE DIFFERENT WORKS ===');
{
  const f = (name) => ({ path: D + name, name, at: '2026-01-01' });
  ok(fromScan([f('ledger.pdf'), f('pipeline.pdf')]).records.length === 2, 'two different documents stay two');
  ok(fromScan([f('report-v1.pdf'), f('report-v1.docx')]).records.length === 2,
     '⚑ a PDF and a DOCX of one name are a source and its export, and which you want depends on the task');
  ok(stemOf('The-Secret-Diary-of-the-Void-v0.3.2-wrap.pdf') === stemOf('The-Secret-Diary-of-the-Void-v0.2.pdf'),
     'two versions share a stem');
  ok(stemOf('diary-v1.pdf') !== stemOf('journal-v1.pdf'), 'and two different names do not');
  ok(stemOf('report (1).pdf') === stemOf('report.pdf'), 'a browser duplicate marker is not a different document');

  // ⚑ SAME NAME, DIFFERENT FOLDER, DIFFERENT WORK. Unscoped, every README on the disk collapsed into
  // one and 78% of the corpus disappeared behind whichever was seen first.
  const readme = (dir) => record({ path: dir + 'README.md', name: 'README.md', at: '2026-01-01' });
  const two = collapse([readme('C:\\proj-a\\'), readme('C:\\proj-b\\')]);
  ok(two.length === 2, '⚑ two READMEs in different folders stay TWO — a shared name is not a shared work');
  const same = collapse([
    record({ path: D + 'x-v0.2.pdf', name: 'x-v0.2.pdf', at: '2026-01-01' }),
    record({ path: D + 'x-v0.3.pdf', name: 'x-v0.3.pdf', at: '2026-02-01' }),
  ]);
  ok(same.length === 1, 'while two versions in the SAME folder still collapse');
  ok(stemOf('notes-2026-06.md') === stemOf('notes.md'), 'nor is a trailing date stamp');

  ok(compareVersions([0, 3, 2], [0, 2]) < 0, '0.3.2 is newer than 0.2');
  ok(compareVersions([1], [0, 9, 9]) < 0, 'and 1 beats 0.9.9');
  ok(compareVersions(null, [1]) > 0, '⚑ an unversioned file sorts LAST — absent is not "version zero"');
  ok(compareVersions(null, null) === 0, 'two unversioned files tie, and the date decides');
  ok(versionOf('x-v0.3.2.pdf').join('.') === '0.3.2', 'a version is parsed');
  ok(versionOf('x.pdf') === null, 'and its absence reported as null');

  // With no versions on either side the DATE has to decide, in both directions, or the winner is
  // really just whichever file the directory listing happened to return first.
  const mk = (name, at) => ({ path: D + name, name, at, meta: {} });
  const rec = (name, at) => record(mk(name, at));
  const older = rec('note-wrap.md', '2026-01-01'), newer = rec('note-final.md', '2026-09-01');
  ok(/final/.test(collapse([older, newer])[0].meta.file), '⚑ the newer date leads when discovered second');
  ok(/final/.test(collapse([newer, older])[0].meta.file), '⚑ and still leads when discovered FIRST — order of discovery decides nothing');

  // collapse() is exported, so it can be handed a broken row directly rather than only via fromScan.
  let threw = false;
  try { collapse([null, newer, undefined, {}]); } catch { threw = true; }
  ok(!threw, 'a null row among real ones does not take the collapse down');
  ok(collapse([null, newer]).length === 1, 'and the real row still comes through');
}

console.log('\n=== §6 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, { path: null }, { path: 7 }, { path: D + 'a.pdf', meta: null }];
  let threw = null;
  for (const j of junk) {
    try { record(j); indexable(j); keepAt(j, 0); titleOf(j); fromScan([j]); } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(record({ path: '' }) === null, 'and a record with no path is refused rather than half-built');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
