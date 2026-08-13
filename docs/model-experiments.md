# Model experiments

Signals that were tried, measured, and rejected. Kept so nobody spends a second
week rediscovering the same negative result.

Everything here was measured with `scripts/backtest.ts`, which replays a
completed season match by match and predicts each fixture using only what was
known before kick-off.

---

## Injuries as a count of unavailable players — rejected, 13 August 2026

**The idea.** API-Football's `/injuries` endpoint is already paid for and lists
who is unavailable for a fixture. Feed the count into the model: a depleted side
scores less and concedes more.

**How it was wired.** Each absence scaled the team's expected goals down and the
opponent's up, capped so no side could be reduced past 18%. Absent data meant
"not known" rather than "nobody out", so fixtures without injury rows predicted
exactly as before and the comparison stayed fair.

**The data was real and plentiful.** Three league-seasons, ~96–100% fixture
coverage, a mean of roughly 4 players out per team per match:

| League | Injury rows | Fixtures covered |
| --- | --- | --- |
| Premier League 2025 | 3,417 | 372 |
| Bundesliga 2025 | 2,832 | 296 |
| Ligue 1 2025 | 2,865 | 310 |

**The result.** Change in Ranked Probability Score against the model without it.
Positive is better; the bar set beforehand was "more than +0.5% consistently".

| League | Change in RPS |
| --- | --- |
| Premier League | **+0.67%** |
| Bundesliga | −0.03% |
| Ligue 1 | **−1.53%** |

Not consistent, and negative on average.

**It is not a matter of tuning.** The effect was swept from 0 to 2× the shipped
weight. No setting produced a positive mean, and the leagues disagreed on the
*sign* at every setting — the Premier League always better, Ligue 1 always
worse, with the gap widening as the weight grew:

| Multiplier | Premier League | Bundesliga | Ligue 1 | Mean |
| --- | --- | --- | --- | --- |
| 0.25 | +0.37% | +0.06% | −0.40% | +0.01% |
| 0.50 | +0.66% | −0.00% | −0.88% | −0.08% |
| 1.00 | +0.67% | −0.03% | −1.53% | −0.29% |
| 2.00 | +0.15% | −0.03% | −0.87% | −0.25% |

A real signal gets stronger with weight and agrees across leagues. This did
neither, which is what amplifying noise looks like.

**Why it probably fails.** A bare count says nothing about *who* is missing. A
squad listing eight fringe players as unavailable scores identically to one
missing its first-choice striker. The provider's injury rows carry no minutes
played, no position and no indication of whether the player would have started.

**What would be worth trying instead.** Weight each absence by how much that
player actually plays — share of minutes or of recent starts. That is a
different signal, not a tuned version of this one, and it needs player-level
data this experiment never touched. Re-run the same replay to judge it.

**Negative control.** Before trusting any of the above, the harness was fed
uniformly random injury counts on 98% of fixtures. It reported −0.13% and
declined to recommend shipping, which is the evidence it does not simply agree
with whoever runs it.

---

## Injuries weighted by minutes played — rejected, 13 August 2026

The obvious answer to why the count failed: weight each absence by how much
that player actually plays, so a first-choice striker outweighs a squad filler.
It does not rescue the signal.

**How it was measured.** Each absent player counted for the fraction of a
regular starter's season he plays, totalled as a share of a starting eleven, and
that share scaled both sides' expected goals. Data came from `/players`
(minutes per player, ~34 paginated requests a season) joined to `/injuries` by
player id. Coverage was good: 372 fixtures, 409 distinct injured players, 89% of
them with minutes on record, a mean of 15.7% of an eleven missing per fixture.

**The result on the Premier League — the league friendliest to the count
version — was +0.33%**, against a bar of +0.5%. Weighting was *worse* than the
raw count there (+0.67%), which is the opposite of what the theory predicts.

**Sweeping the strength does not save it.** The ceiling is +0.42%:

| Strength | Change in RPS |
| --- | --- |
| 0.5x | +0.19% |
| 1.0x | +0.33% |
| 1.5x | +0.40% |
| 2.0x | **+0.42%** |
| 3.0x | +0.37% |
| 4.0x | −0.23% |

**Three thumbs were on the scale for that +0.42%, and it still failed.**

1. *Leakage.* Minutes were season totals, which include matches played after the
   fixture being predicted. Weighting a round-5 absence by end-of-season minutes
   uses information that did not exist yet. This was deliberate: it measures the
   optimistic ceiling cheaply, so a failure here is conclusive without building
   the expensive per-fixture version.
2. *Best case league.* Ligue 1 cost the count version 1.53%; only the Premier
   League was tested here, and only because it was the one that looked
   promising.
3. *Tuned in-sample.* The +0.42% is the best of seven settings chosen on the
   same data it is reported against.

An honest, non-leaky, cross-league number would be lower than +0.42%, and
+0.42% already fails.

**What this rules out.** Not "injuries do not matter in football" — they plainly
do. What it rules out is that *this provider's injury list, weighted by season
minutes, adds anything to a Poisson model built on standings and form*. The
likely reasons: the list mixes long-term absentees with day-before knocks
without distinguishing them; it says nothing about position, so a missing
third-choice goalkeeper and a missing centre-forward weigh the same once
minutes are equal; and a team's recent form already contains the effect of
whoever has been missing.

**What would still be worth trying.** A signal that knows *position* and
*recency* — the striker who got injured this week, not the defender who has been
out since August. That needs lineup history rather than an injury list, and it
is a different experiment, not a tuned version of this one.

---

## Lineups — not attempted, and why

The provider publishes confirmed line-ups roughly 20–60 minutes before
kick-off. The feed shows today, tomorrow and this week, so for nearly every
fixture a visitor sees, no line-up exists yet.

A backtest would have had line-ups for 100% of historical fixtures and
production would have them for a handful, so the measurement would have
flattered the idea rather than tested it. If line-ups are used at all they
belong on the match page for imminent fixtures, as a display, not as a feed-wide
prediction input.
