# didy-kernels

**The pure kernels behind a didy, published so somebody who is not their author can run the gate.**

[![gate](https://github.com/sjgant80-hub/didy-kernels/actions/workflows/gate.yml/badge.svg)](https://github.com/sjgant80-hub/didy-kernels/actions/workflows/gate.yml)

Part of [Fall World](https://sjgant80-hub.github.io/fallworld/) · MIT

---

## Why this repo exists

A didy climbs a ten-rung ladder. Rungs 1–4 it can establish alone. From 5 a machine has to agree
with it. **From 7 a stranger does** — and the last rung, `Sovereign`, asks something no amount of
local effort can supply:

> can it show a stranger the evidence, without asking to be believed?

A green mutation gate on the author's own laptop does not answer that. It says the gate passed *on
hardware the claimant controls*, which is exactly the evidence a stranger has no reason to accept.

So the kernels are published, and **GitHub's runner clones them fresh and runs the same pinned gate**.
That run — on a machine nobody here owns — is the only thing that flips `selfGraded` to false.

**Nothing private is here.** No credentials, no memory, no seed, no personal state. These are pure
functions; the didy that uses them stays on its owner's machine and is never published.

## What's in it

| Kernel | What it refuses |
|---|---|
| `loadout.mjs` | unproven gear cannot be equipped; a build is the union of its gear **clamped** to what the character holds |
| `endgame.mjs` | there is **no setter** for level, and you cannot skip a rung |
| `organcheck.mjs` | an organ is admitted because it was **read**, never because it arrived claiming to be fine |
| `find.mjs` | nonsense returns **nothing**, and says so — rather than padding with its ten least-bad rows |
| `sessions.mjs` | a system reminder, a tool result and a compaction summary all wear the user's role and are **not the user** |
| `episodes.mjs` | co-occurrence is the only relation a transcript asserts — `related`, never an invented predicate |
| `artifacts.mjs` | secrets are never indexed; contents are never stored; **"everything" is not a corpus, it is a disk** |
| `act.mjs` | a **measured** gap and an **inferred** one are never blended into one list, and the bound travels with the task |
| `organs/ledger.mjs` | an entry that does not balance **is not recorded** — and a correction is a new entry, never an edit |
| `organs/pipeline.mjs` | a deal cannot enter a stage it has not earned; the forecast carries its exclusions |
| `organs/deadline.mjs` | an unknown legal rule is **refused, never estimated** |
| `organs/roster.mjs` | you cannot claim a skill, only demonstrate it — and a demonstration expires |

## The gate

```bash
node gate-all.mjs
```

Every kernel is mutated and every mutant must die, or be baselined **with a written reason**. A
survivor with no reason is an open hole; a gate that killed nothing is not evidence, it is a green
light. CI fails on either.

Current: **208 mutants killed · 0 unexplained · 1 baselined with a proof of equivalence.**

## A note on what is NOT here

`find.mjs` takes its `recall` and `shadows` as arguments rather than importing them. That is not
decoration: the implementations live in a memory kernel that holds private material and is never
published. Injecting them means the search is pure, standalone, gate-able by anyone — and the thing
holding the private parts stays on its owner's machine.

It also turned out to be the better shape. A search you cannot hand a different recall is a search
you cannot test without building the entire body first.

## The honest bound

CI green proves the *kernels* hold under mutation on a machine the author does not own. It says
nothing about the didy running them, the data it holds, or anyone's business outcomes. That is the
whole claim, and it is deliberately small.
