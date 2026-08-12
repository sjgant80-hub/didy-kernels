Add find.mjs — the search, with its dependencies injected rather than imported

find.mjs searches the estate by meaning first, then literally, and reports WHY
each row came back. The property worth gating is the negative space: nonsense
returns nothing and says so, rather than padding with its ten least-bad rows.

It takes recall and shadows as ARGUMENTS. That is what makes it publishable:
the implementations live in a memory kernel carrying private material that is
never published, and importing them would have meant publishing that too. It is
also the better shape - a search you cannot hand a different recall is a search
you cannot test without building the whole body first.

Getting it clean removed code rather than justifying it. Four survivors had
written proofs of equivalence, and every one was a signal that an unreachable
branch was sitting there: a null-record guard both callers made impossible, a
third name fallback that could not fire, a tiebreak re-asserting an order the
input already had, and a sort chain whose branches could never both differ.
Deleting them beat explaining them - dead defensive code reads exactly like a
live check when you come back to it.

Two real bugs fell out. The raw recall score was compared against the floor
while a rounded one was reported, so a hit shown as 8 might have been 7.996 and
turned away with nothing on the row to say so. And the filter re-tested a
threshold admission had already enforced, which could never fail except with a
floor of zero, where it admitted a words-only hit whose word score was too weak
purely because zero cleared a floor of zero.

44/44 killed, 84 tests, empty baseline. Repo total now 208 killed across eight
kernels, 0 unexplained.
