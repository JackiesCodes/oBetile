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

## Lineups — not attempted, and why

The provider publishes confirmed line-ups roughly 20–60 minutes before
kick-off. The feed shows today, tomorrow and this week, so for nearly every
fixture a visitor sees, no line-up exists yet.

A backtest would have had line-ups for 100% of historical fixtures and
production would have them for a handful, so the measurement would have
flattered the idea rather than tested it. If line-ups are used at all they
belong on the match page for imminent fixtures, as a display, not as a feed-wide
prediction input.
