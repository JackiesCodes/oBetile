import Link from "next/link";

export const metadata = {
  title: "How our football predictions work — oBetile",
  description:
    "The method behind oBetile's win percentages, and how accurate they have measured against six completed league seasons.",
};

/**
 * The public methodology page.
 *
 * Percentages are the product here, so the basis for them is stated openly:
 * where each number comes from, how the model works, how accurate it measured,
 * and where it fails. Every figure below is reproducible from
 * scripts/backtest.ts against the same public data the site runs on.
 */

/** Measured by scripts/backtest.ts. Update both together. */
const SEASONS = [
  { league: "Premier League", season: "2025", lift: "5.9%" },
  { league: "La Liga", season: "2025", lift: "5.7%" },
  { league: "Serie A", season: "2025", lift: "8.2%" },
  { league: "Bundesliga", season: "2025", lift: "10.4%" },
  { league: "Ligue 1", season: "2025", lift: "4.9%" },
  { league: "Brasileirão", season: "2025", lift: "3.4%" },
];

const CALIBRATION = [
  { band: "20–30%", said: "25.7%", happened: "26.3%" },
  { band: "30–40%", said: "34.0%", happened: "32.8%" },
  { band: "40–50%", said: "44.8%", happened: "45.5%" },
  { band: "50–60%", said: "54.6%", happened: "55.4%" },
  { band: "60–70%", said: "64.4%", happened: "62.0%" },
];

export default function HowPredictionsWorkPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 text-gray-300 text-sm leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_a]:text-brand-green [&_a]:underline">
      <h1 className="text-white text-2xl font-bold mb-1">How our predictions work</h1>
      <p className="text-gray-500 text-xs mb-6">Last measured 11 August 2026</p>

      <p>
        Every percentage on oBetile is an estimate of how likely an outcome is. This page explains
        where those numbers come from and how often they turn out to be right, so you can judge them
        rather than take them on trust.
      </p>

      <h2>Where a percentage comes from</h2>
      <p>
        <strong>If bookmakers price the match</strong>, we use their published prices. Those prices
        include a built-in margin, so the raw numbers add up to more than 100%; we remove that margin
        before showing anything, which is why our percentages total 100 and are slightly lower than
        the ones you would read straight off a betting site.
      </p>
      <p>
        <strong>If nobody prices it</strong> — which is most matches outside the major leagues — we
        compute the estimate ourselves, using only data already on the site.
      </p>
      <p>
        <strong>If we cannot do either</strong>, the match shows a dash. Cup ties, friendlies, youth
        and reserve fixtures usually have no league table behind them, and early in a season a table
        describes the fixture list more than the teams. We would rather show nothing than fill the
        space with a number we do not believe.
      </p>

      <h2>How the model works</h2>
      <p>
        It is a Poisson goals model, the standard approach for this problem. In outline:
      </p>
      <ul>
        <li>
          Each team&apos;s attacking and defensive strength is measured against its own league, using
          home and away records separately — so home advantage comes out of the real data rather
          than being a fixed number someone picked.
        </li>
        <li>
          Those strengths give an expected goals figure for each side in this particular fixture.
        </li>
        <li>
          Recent form adjusts it slightly, and head-to-head record adjusts it less. Both are small
          samples, so both are deliberately given little weight.
        </li>
        <li>
          Every plausible scoreline is then summed into the three outcomes: home win, draw, away win.
        </li>
      </ul>
      <p>
        Two corrections matter enough to name. Short records are pulled toward the league average,
        because a team that has scored at twice the league rate over ten home games is usually good
        but rarely twice as good. And the final figures are deliberately flattened, because the model
        was measurably more confident than its record justified.
      </p>

      <h2>How accurate it is</h2>
      <p>
        We test by replaying completed seasons match by match. Each fixture is predicted using only
        what was known before it kicked off, then scored against the actual result — nothing that
        happened in or after a match is ever visible to its own prediction.
      </p>
      <p>
        The benchmark is a forecast that simply predicts the season&apos;s eventual home/draw/away
        split for every match. That is a demanding bar, because it is allowed to know the answer in
        advance. The model beat it in all six seasons tested:
      </p>

      <div className="overflow-x-auto my-4">
        <table className="w-full text-xs border border-brand-dark-5 rounded">
          <thead>
            <tr className="bg-brand-dark-3 text-gray-400 text-left">
              <th className="px-3 py-2 font-semibold">Competition</th>
              <th className="px-3 py-2 font-semibold">Season</th>
              <th className="px-3 py-2 font-semibold">Better than benchmark by</th>
            </tr>
          </thead>
          <tbody>
            {SEASONS.map((s) => (
              <tr key={s.league} className="border-t border-brand-dark-5">
                <td className="px-3 py-2 text-gray-300">{s.league}</td>
                <td className="px-3 py-2 text-gray-500">{s.season}</td>
                <td className="px-3 py-2 text-brand-green">{s.lift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        The single outcome we rate highest happens about <strong>48–52%</strong> of the time. That is
        better than the benchmark, and it is still wrong about half the time. Football is genuinely
        hard to predict, and any site claiming much better than this is not being straight with you.
      </p>

      <h2>Whether the percentages mean what they say</h2>
      <p>
        Being right more often is not the same as being honest about confidence. A model can rank
        matches well and still overstate how sure it is. So we also check that a stated percentage
        matches reality: of the matches we call at 60%, do roughly 60% happen?
      </p>
      <p>
        These figures come from three seasons — the Bundesliga, Ligue 1 and the Brasileirão — that
        were never used to build or tune the model:
      </p>

      <div className="overflow-x-auto my-4">
        <table className="w-full text-xs border border-brand-dark-5 rounded">
          <thead>
            <tr className="bg-brand-dark-3 text-gray-400 text-left">
              <th className="px-3 py-2 font-semibold">When we said</th>
              <th className="px-3 py-2 font-semibold">Average claim</th>
              <th className="px-3 py-2 font-semibold">Actually happened</th>
            </tr>
          </thead>
          <tbody>
            {CALIBRATION.map((c) => (
              <tr key={c.band} className="border-t border-brand-dark-5">
                <td className="px-3 py-2 text-gray-300">{c.band}</td>
                <td className="px-3 py-2 text-gray-500">{c.said}</td>
                <td className="px-3 py-2 text-brand-green">{c.happened}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Each band lands within roughly two points of its claim. Before we corrected for
        overconfidence the gaps ran to eleven points — matches called at 70–80% were coming in only
        63% of the time.
      </p>

      <h2>What this does not cover</h2>
      <ul>
        <li>
          <strong>Injuries, suspensions, transfers and team news are not used.</strong> A side missing
          its best striker looks the same to the model as a side at full strength.
        </li>
        <li>
          <strong>It does not know what is at stake.</strong> A dead rubber and a relegation decider
          are treated alike.
        </li>
        <li>
          <strong>Testing was done on established league competitions.</strong> Cups, youth and
          amateur fixtures where a table exists get a percentage, but the accuracy above was not
          measured on them and is likely worse.
        </li>
        <li>
          <strong>Early-season figures are the weakest,</strong> even where we show them at all.
        </li>
      </ul>

      <h2>In plain terms</h2>
      <p>
        These percentages are a reasonable, tested estimate — better than guessing, honest about how
        sure they are, and wrong often. They are not advice, not a tip, and not a reason to risk
        money. Please read them as the informed opinion they are.
      </p>
      <p className="mt-6">
        <Link href="/legal/terms">Terms of Use</Link>
      </p>
    </div>
  );
}
