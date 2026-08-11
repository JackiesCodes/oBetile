# oBetile — Pre-Launch Legal & Compliance Actions

**Prepared:** 7 August 2026
**Site:** o-betile.vercel.app · **Repository:** github.com/JackiesCodes/oBetile
**Operator contact:** mashabealbin022@gmail.com

> **This document is not legal advice.** It was produced by reviewing the codebase and
> git history, not by a qualified lawyer. It records what was found, what has already
> been fixed in code, and what still needs a decision or professional review. Items 1
> and 2 should be actioned before any public launch.

---

## Summary

| # | Item | Severity | Owner | Status |
|---|------|----------|-------|--------|
| 1 | Public repo documents scraping a competitor | **High** | You — today | **Open** |
| 2 | Gambling framing under Botswana law | **High** | Lawyer | **Open** |
| 3 | API-Football terms: caching, redistribution, trademarks | Medium | You | **Open** |
| 4 | Data protection registration / obligations | Medium | Lawyer | **Open** |
| 5 | "oBetile" name and trademark clearance | Medium | Lawyer | **Open** |
| 6 | Club badges and competition trademarks | Low–Medium | You | Mitigated in code |
| 7 | Legal pages, disclosures, right to erasure | — | — | **Done in code** |

---

## 1. The public repository documents scraping a competitor — **High**

### What was found

The repository is **public**. Its first commit, `53687f0`, carries this message verbatim:

> "Next.js 16 + TypeScript + Tailwind CSS sports betting site **modelled after Betway
> Botswana**. Includes soccer/live pages, bet slip context, league sections with live
> odds, and **match data extracted from betway.co.bw**."

That commit contains a 328-line `data/matches.ts` including roughly 23 fixtures and the
sport "live count" figures taken from that site.

### Why it matters

The concern is **not** primarily copyright. Individual fixtures, scores and kick-off
times are facts, and facts are generally not protected by copyright.

The concern is that a public, timestamped, attributed commit message is **a written
admission**, in your own name, that you extracted data from a named competitor and
modelled your product on theirs. That creates two distinct exposures:

- **Breach of terms of use** — a contract claim, not a copyright one. Most betting
  operators' terms prohibit automated extraction. This does not require the data to be
  protectable.
- **Trade dress / passing off** — "modelled after Betway Botswana" invites the argument
  that the look and feel was copied.

If Betway's legal team ever reviews oBetile, this commit is the first thing they will
find, and it was volunteered rather than discovered.

### Current state

The scraped data is **no longer in the running application**. It was removed during
earlier work (commits `a2c60c3` and `298b0ac` replaced hardcoded fixtures with live
API data), and the last remnants — the invented per-sport "live counts" — were removed
in the pre-launch data-accuracy pass. No Betway-derived content is served today. All
match data now comes from a paid API-Football subscription.

The scraping tooling (`.firecrawl/`, `parse_sports.js`) was never committed; it is
listed in `.gitignore`.

**But git history is permanent and, while the repo is public, world-readable.**

### Recommended actions

1. **Make the repository private — today.** One setting change, immediate effect,
   removes public discoverability. Do this first regardless of anything else.
2. **Decide whether to purge history.** Rewriting the initial commit's message and
   removing that file from history is possible (`git filter-repo`, then a force-push).
   It is more involved: it rewrites every commit hash, requires re-pointing the Vercel
   integration, and cached copies may persist on GitHub for a period. Worth doing if
   the repo will ever be public again or shown to investors or acquirers.
3. **Do not reuse the phrasing.** Avoid "modelled after \<competitor\>" in commits,
   marketing or pitch material.

---

## 2. Gambling framing under Botswana law — **High** — needs a lawyer

### What was found

The product is genuinely **not** gambling: there is no deposit, stake, wallet, payout or
prize of value anywhere in the code. Predictions are recorded for interest only.

However, the presentation sits close to the line:

- The product is named **o*Bet*ile**, with "Bet" rendered in the brand's accent colour
  in the logo (`components/Header.tsx`).
- Internal code names remain betting-derived: `BetSlip.tsx`, `BetSlipContext.tsx`,
  `addBet()`, `hasBet()`. These are **not user-visible**, but would appear in any
  technical review.
- The match rows now display **win percentages derived from bookmaker odds**.
- Some competition and market vocabulary (e.g. "Asian Handicap") is betting vocabulary.

### Why it matters

Botswana regulates gambling under the **Gambling Act 2012**, administered by the
Gambling Authority. Free-to-play prediction games generally fall outside licensing
because there is no stake and no prize — but regulators assess **presentation and
consumer perception**, not just mechanics. A product named "oBetile" showing odds-derived
percentages could attract questions even though no gambling occurs.

There is a second angle: if the site is ever monetised through **affiliate links to
bookmakers**, the analysis changes materially and advertising rules engage.

### Questions for a Botswana-qualified lawyer

1. Does a free predictions platform with no stake or prize require any licence or
   notification under the Gambling Act 2012?
2. Does the name "oBetile" or odds-derived percentage display create regulatory or
   advertising exposure despite no gambling taking place?
3. What would change if we later added bookmaker affiliate links or advertising?
4. Are age restrictions or responsible-gambling messaging mandatory for this category?
   (An 18+ statement and a "not a bookmaker" disclaimer are already displayed.)

### Optional code-side mitigation

The internal identifiers can be renamed (`BetSlip` → `PredictionSlip`, `addBet` →
`addPrediction`, etc.). It is cosmetic, touches several files, and carries a small
regression risk, so it was **not** done unprompted. Say the word and it can be.

---

## 3. API-Football terms of service — **Medium** — you to verify

The application depends entirely on a paid API-Football subscription (Pro plan,
7,500 requests/day). Three specific things need checking against your subscription terms,
because the code does all of them:

| Behaviour | Where |
|---|---|
| **Caching responses** for 30 s – 15 min and serving them to many users | `revalidate` in `lib/api-football.ts`; `ODDS_TTL` |
| **Redistributing derived data** — odds converted to win percentages | `lib/odds.ts`, `/api/football/odds` |
| **Hotlinking their media CDN** for club badges | `media.api-sports.io`, allowed in the CSP |

Caching and display are ordinary and near-certainly permitted; this is a confirm-don't-assume
item. Check specifically whether attribution is **required** and in what form. A credit line
is already in the site footer regardless.

**Also:** the subscription **expires 5 September 2026**. If it lapses, all match data stops
and the site degrades to empty panels. Set a renewal reminder.

---

## 4. Data protection obligations — **Medium** — lawyer to confirm scope

The site collects and stores personal data: email addresses (via Supabase Auth),
usernames, avatar URLs, and activity records (predictions, favourites, votes, community
posts, likes).

**Botswana's Data Protection Act 2018** is in force. Confirm with a lawyer:

1. Whether oBetile must **register with the Information and Data Protection Commission**
   as a data controller, and any filing fee or timeline.
2. Whether hosting personal data **outside Botswana** (Supabase in `eu-central-1`,
   Vercel in `iad1`/US) triggers cross-border transfer requirements.
3. Whether a **Data Protection Officer** is required at your scale.
4. Whether **GDPR** applies — it will if you knowingly offer the service to users in the
   EU/UK. **Treat this as likely rather than possible:** the site's copy was changed on
   11 August 2026 from "Soccer Predictions in Botswana" to worldwide coverage naming
   European competitions, which is close to an explicit statement that EU users are being
   targeted. The published privacy policy already honours the core rights (access,
   correction, erasure) regardless, but ask specifically whether an EU representative or
   a lawful-basis record is needed.

**Already handled in code:** privacy policy, terms of use, an explicit statement that no
analytics or third-party trackers run (enforced by the CSP), and working self-service
account deletion.

---

## 5. Name and trademark clearance — **Medium** — lawyer

"oBetile" has not been cleared. Before investing in the brand:

1. Search the **Companies and Intellectual Property Authority (CIPA)** register in
   Botswana for conflicting marks.
2. Consider registering "oBetile" in the relevant class.
3. Confirm the name does not read as passing off relative to any existing betting brand
   — this connects to item 1.

---

## 6. Club badges and competition names — **Low–Medium**

Club crests are served from API-Football's CDN and displayed next to fixtures. Badges and
competition names are **trademarks of their owners**, licensed to nobody here.

Displaying them to identify the match being described is standard industry practice and
generally defensible as nominative use. To stay on the right side of it:

- **Do not** use any club badge in an app icon, favicon, social avatar or advertising.
- **Do not** imply endorsement, partnership or official status.
- The footer already states that badges are their owners' trademarks, shown only to
  identify matches, implying no affiliation.

---

## 7. Completed in code

Deployed 7 August 2026 (commit `a32d336`):

- **`/legal/privacy`** — written from the app's actual data flows: the exact records
  held, which are public versus private, the single strictly-necessary session cookie,
  the four processors (Supabase, Vercel, API-Football, Google Fonts), retention, and
  user rights. States that no analytics or third-party trackers run.
- **`/legal/terms`** — what the site is and is not, an explicit "not a bookmaker, no
  money staked or won" statement, an accuracy warning that percentages are estimates and
  not betting advice, an 18+ requirement, community rules, and IP/trademark attribution.
- **Site-wide footer** — not-a-bookmaker disclaimer, 18+, "percentages are estimates,
  not advice", API-Football attribution, trademark notice, and links to both policies.
- **Account deletion** — a Delete Account control on the profile page backed by
  `delete_own_account()`. The function takes no arguments and derives identity from
  `auth.uid()`, so it can only ever delete the caller; deletion cascades to profile,
  picks, favourites, votes, posts and likes. Execute granted to signed-in users only.
  This satisfies right-to-erasure without placing a `service_role` key in the app.
- **Wording** — the last user-facing "betting market" string was reworded.

**Both policy pages need a lawyer's review before you rely on them.** They are accurate
descriptions of system behaviour, which is the hard part and the part most templates get
wrong — but they have not been reviewed for legal sufficiency in your jurisdiction.

---

## Recommended order

1. **Make the repository private.** Today. Free, instant, and closes the most avoidable
   exposure.
2. **Book a Botswana-qualified lawyer** covering items 2, 4 and 5 together — likely a
   single consultation. Bring this document and the two published policy pages.
3. **Read your API-Football subscription terms** on caching, redistribution and
   attribution (item 3), and diarise the 5 September renewal.
4. **Decide on history purging** (item 1, step 2) once the lawyer has weighed in on how
   much the Betway association matters.
