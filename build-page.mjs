// build-page.mjs — GENERATE index.html FROM THE GATE RECORD AND THE KERNELS THEMSELVES.
//
// ⚑ Nothing on the page is typed. The mutant counts come from `witness.results.json`, which is written
// by a real gate run; the title and the refusal of each kernel are read out of its own header comment.
// So the page cannot claim a number the gate did not produce, and cannot describe a kernel as refusing
// something it stopped refusing. Re-run it and the page is true again.
//
//   node build-page.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const results = JSON.parse(readFileSync(join(HERE, 'witness.results.json'), 'utf8'));

/** A kernel's own words: the title line, and the first ⚑ claim in its header. */
function describe(file) {
  const p = join(HERE, file);
  if (!existsSync(p)) return { title: basename(file), refuses: '' };
  const head = readFileSync(p, 'utf8').slice(0, 4000);
  const title = (head.match(/^\/\/\s*[\w.\/-]+\s*[—-]\s*(.+?)\s*$/m) || [, ''])[1];

  // The first flagged claim, unwrapped from its comment block. These are written as the ONE thing the
  // kernel refuses, so they are exactly what a visitor needs and exactly what must not be re-typed.
  const lines = head.split('\n');
  const start = lines.findIndex(l => /^\/\/\s*⚑/.test(l));
  let refuses = '';
  if (start >= 0) {
    const buf = [];
    for (let i = start; i < lines.length; i++) {
      if (!/^\/\//.test(lines[i])) break;
      const t = lines[i].replace(/^\/\/\s?/, '').trim();
      if (!t && buf.length) break;
      if (t) buf.push(t.replace(/^⚑\s*/, ''));
    }
    refuses = buf.join(' ');
  }
  return { title: title.replace(/\.$/, ''), refuses: refuses.slice(0, 340) };
}

const rows = results.runs.map(r => ({ ...r, ...describe(r.kernel) }));
const total = results.killed, unexplained = results.unexplained, clean = results.allClean;
const baselined = rows.reduce((s, r) => s + (r.baselined || 0), 0);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>didy-kernels — ${total} mutants killed</title>
<meta name="description" content="The pure kernels behind a didy, published so somebody who is not their author can run the gate. ${total} mutants killed across ${rows.length} kernels.">
<style>
  :root{
    --bg:#0a0c0f;--panel:#11151b;--line:#232b36;--ink:#dde5ef;--dim:#8d9bad;--faint:#5d6b7d;
    --ok:#3fb27f;--warn:#d9a441;--accent:#6ea8fe;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  }
  *{box-sizing:border-box} html,body{margin:0}
  body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55}
  .wrap{max-width:960px;margin:0 auto;padding:0 18px 72px}
  a{color:var(--accent)} code{font-family:var(--mono);font-size:.92em}
  header{padding:46px 0 24px;border-bottom:1px solid var(--line)}
  h1{font-family:var(--mono);font-size:clamp(23px,4.2vw,34px);margin:0 0 10px;letter-spacing:-.02em}
  h1 .n{color:var(--ok)}
  .lede{color:var(--dim);max-width:62ch;margin:0;font-size:clamp(15px,2.2vw,17.5px)}
  .lede b{color:var(--ink);font-weight:600}
  .stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
  .stat{font-family:var(--mono);font-size:12px;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:5px 11px;color:var(--dim)}
  .stat b{color:var(--ink)} .stat.ok b{color:var(--ok)}
  h2{font-size:12.5px;font-family:var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:36px 0 14px}
  .k{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:15px 17px;margin-bottom:10px}
  .k .top{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline}
  .k .name{font-family:var(--mono);font-size:15px;color:var(--ink)}
  .k .title{color:var(--dim);font-size:13.5px;flex:1;min-width:180px}
  .k .num{font-family:var(--mono);font-size:12px;color:var(--ok);white-space:nowrap}
  .k .num.warn{color:var(--warn)}
  .k .ref{margin:9px 0 0;font-size:13.5px;color:var(--dim);border-left:2px solid var(--line);padding-left:11px}
  .note{border-left:2px solid var(--line);padding-left:13px;color:var(--dim);font-size:13.5px;margin:14px 0}
  .note.warn{border-left-color:var(--warn)}
  .note b{color:var(--ink)}
  pre{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:14px 16px;overflow-x:auto;font-family:var(--mono);font-size:12.5px;color:var(--dim);margin:0}
  footer{margin-top:42px;padding-top:20px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px}
</style>
</head>
<body><div class="wrap">

<header>
  <h1>didy-kernels · <span class="n">${total}</span> mutants killed</h1>
  <p class="lede">The pure kernels behind a didy, published so <b>somebody who is not their author can run the gate</b>.
  A green gate on your own laptop says the code passed on hardware you control — which is exactly the evidence a
  stranger has no reason to accept.</p>
  <div class="stats">
    <span class="stat ok"><b>${total}</b> mutants killed</span>
    <span class="stat"><b>${rows.length}</b> kernels</span>
    <span class="stat ok"><b>${unexplained}</b> unexplained</span>
    <span class="stat"><b>${baselined}</b> baselined with a written proof</span>
    <span class="stat">gate run <b>${esc(results.ran)}</b></span>
    <span class="stat${clean ? ' ok' : ''}"><b>${clean ? 'all clean' : 'NOT CLEAN'}</b></span>
  </div>
</header>

<h2>What each one refuses</h2>
${rows.map(r => `<div class="k">
  <div class="top">
    <span class="name">${esc(r.kernel)}</span>
    <span class="title">${esc(r.title)}</span>
    <span class="num${r.clean ? '' : ' warn'}">${r.killed} killed${r.baselined ? ` · ${r.baselined} baselined` : ''}${r.clean ? '' : ' · NOT CLEAN'}</span>
  </div>
  ${r.refuses ? `<p class="ref">${esc(r.refuses)}</p>` : ''}
</div>`).join('\n')}

<h2>The gate</h2>
<pre>node gate-all.mjs</pre>
<p class="note">Every kernel is mutated and every mutant must die, or be baselined <b>with a written reason</b>.
A survivor with no reason is an open hole; a gate that killed nothing is not evidence, it is a green light.
CI fails on either.</p>
<p class="note"><b>An unreadable gate record is not a pass.</b> A baseline file that cannot be parsed is
reported as an unexplained survivor rather than treated as empty — which caught a UTF-8 BOM that would
otherwise have read as clean forever.</p>

<h2>The honest bound</h2>
<p class="note warn">CI green proves these <b>kernels</b> hold under mutation on a machine the author does not
own. It says nothing about the agent running them, the data it holds, or anyone's business outcomes.
That is the whole claim, and it is deliberately small.</p>

<footer>
  <p><b>Generated, never typed.</b> The counts come from <code>witness.results.json</code>, written by a real
  gate run. Each kernel's title and refusal are read from its own header. Re-run <code>node build-page.mjs</code>
  and this page is true again — it cannot claim a number the gate did not produce.</p>
  <p>MIT · part of the Fall estate · <a href="https://github.com/sjgant80-hub/didy-kernels">source</a> ·
  <a href="https://github.com/sjgant80-hub/didy-kernels/actions/workflows/gate.yml">CI</a> ·
  <a href="https://sjgant80-hub.github.io/fallworld/">fall world</a></p>
</footer>
</div></body>
</html>
`;

writeFileSync(join(HERE, 'index.html'), html);
console.log(`index.html — ${rows.length} kernels · ${total} killed · ${unexplained} unexplained · ${(html.length / 1024).toFixed(0)}KB`);
for (const r of rows) if (!r.refuses) console.log(`  NB ${r.kernel} has no ⚑ claim in its header — nothing to show`);
