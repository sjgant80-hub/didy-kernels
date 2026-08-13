Publish the four kernels that were gated once and then forgotten

sessions, episodes, artifacts and find were each mutation-gated by hand when
they were written, and none of them entered gate-all.mjs. So the record every
downstream surface reads - the character sheet's rung 5, this repo's CI - was
reporting 164 mutants when 319 had actually been killed. A kernel gated once
and never again is gated at a moment, not continuously.

All four are pure and standalone. find.mjs takes its recall and shadows as
arguments rather than importing them, because the implementations live in a
memory kernel that holds private material; the other three have no imports at
all. Their tests import nothing but the kernel under test.

What each refuses:

  sessions  - a system reminder, a tool result and a compaction summary all
              arrive wearing the user's role and are not the user. The filter
              is a FIELD (origin.kind), not a pattern list, because a field
              catches machine origins nobody has invented yet.
  episodes  - co-occurrence is the only relation a transcript honestly
              asserts. The predicate is `related`, never an invented one, and
              topics are grounded in real names so the graph cannot fill with
              "thing" and "build".
  artifacts - secrets are never indexed, contents are never stored, and
              "everything" is not a corpus - it is a disk. Version collapse is
              scoped to the folder, because filename alone folded 78% of a
              real corpus away by merging every README into one.

Also fixes a baseline file that carried a UTF-8 BOM, which made JSON.parse
throw. The gate reported that honestly as an unexplained survivor rather than
treating an unreadable record as a pass - which is the correct direction to
fail, and had teeth: rung 5 requires zero unexplained.

319 killed across eleven kernels, 0 unexplained, 1 baselined with a written
proof of equivalence.
