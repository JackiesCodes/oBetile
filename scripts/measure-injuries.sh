#!/usr/bin/env bash
#
# Does team availability actually improve the model?
#
# Replays six completed league seasons twice — once as the model runs today,
# once with injury counts folded in — and prints both. Run it from a machine
# with plain internet access; it reads everything from the deployed API, so it
# needs no API key and no stored dataset.
#
#   ./scripts/measure-injuries.sh
#
# Read the "availability changes RPS by" line for each league. The signal earns
# its place only if that is consistently positive by more than about half a
# percent. If it is not, the honest outcome is to delete the wiring rather than
# keep complexity that buys nothing — a bare count of absences says nothing
# about whether the missing players would have started.
#
# A negative control is already on record: fed uniformly random injury counts,
# this harness reported -0.13% and refused to recommend shipping.

set -uo pipefail

BASE="${BASE:-https://o-betile.vercel.app}"
SEASON="${SEASON:-2025}"

# id:label — the same six seasons the model was originally validated against.
LEAGUES=(
  "39:Premier League"
  "140:La Liga"
  "135:Serie A"
  "78:Bundesliga"
  "61:Ligue 1"
  "71:Brasileirao"
)

echo "measuring against $BASE, season $SEASON"
echo

for entry in "${LEAGUES[@]}"; do
  id="${entry%%:*}"
  label="${entry#*:}"
  printf '=== %s (league %s) ===\n' "$label" "$id"
  npx tsx --tsconfig tsconfig.json scripts/backtest.ts \
    --league "$id" --season "$SEASON" --base "$BASE" --injuries \
    2>&1 | grep -E "^(fixtures|model|baseline|RPS|availability)" || echo "  failed — see full output by running the command without the grep"
  echo
done

cat <<'NOTE'
If availability helps, wiring it into production is small: in
app/api/football/model/route.ts, fetch /api/football/injuries once per
competition alongside the standings call, and pass the result through
availabilityFor() into predictFixture's `availability` argument.

If it does not help, remove the availability argument from the model route plan
and keep lib/availability.ts only if the match page uses it to display who is
out — which is worth showing to a reader either way.
NOTE
