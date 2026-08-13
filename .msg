Add act.mjs - the consumer that makes a diagnostic worth having

A liveness diagnostic had been reporting 31 orbiting folds - work touched
inside the window that leaves nothing anyone else can run - and nothing read
it. A diagnostic nobody acts on costs the same as being wrong. This is the
consumer: it turns the verdict into an agenda.

Two properties carry the weight:

  MEASURED AND INFERRED ARE NEVER BLENDED. An orbit is a fact: this was
  touched, and it serves no page. A shadow is an inference: this was circled
  and never committed to. Both belong on an agenda, but ranking them into one
  undifferentiated list is how a measurement gets diluted into a hunch, so
  every row is labelled with which kind of claim it is and the measured ones
  lead.

  THE BOUND TRAVELS WITH THE TASK. "Orbit" means no live page. It does not
  mean unused, unfinished or bad - whether anyone actually runs a thing cannot
  be read from repo metadata, and turning a finding into a to-do does not
  upgrade the evidence behind it. That sentence ships in the output rather
  than in a footnote nobody reads.

Smaller calls that are still real: every row states what would close it, and
concretely ("ship a page anyone can open", not "improve it"); an idea circled
once is a passing thought rather than an agenda item; truncation is reported,
because a list of ten reads identically whether it is all of them or the first
ten of ninety, and only one of those is finishable; and an empty agenda says
which two things that could mean rather than looking like success.

Getting it clean removed constructs rather than excusing them. A ternary whose
two arms both yielded zero at the boundary could not be made to fail, and two
fallback guards were dead because the filter above already guaranteed a
number - both replaced rather than baselined. One mutant landed inside a
comment that quoted an operator, which is now the fourth time that has
happened here and is worth naming as a habit: do not write operators in prose.

15 killed, 41 tests, empty baseline. Repo total: 334 across twelve kernels,
0 unexplained, 1 baselined with a written proof of equivalence.
