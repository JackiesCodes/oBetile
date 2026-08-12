import Link from "next/link";

/**
 * Carries the disclosures that need to be reachable from every page: what the
 * site is not (a bookmaker), where the data comes from, and links to the terms
 * and privacy policy.
 */
export default function Footer() {
  return (
    <footer className="border-t border-brand-dark-5 bg-brand-dark-2 px-4 py-5 mt-6">
      <div className="max-w-3xl mx-auto space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-semibold">oBetile is not a bookmaker.</span>{" "}
          No money can be staked or won here. Win percentages are estimates — from published
          bookmaker prices where a match is priced, otherwise from our own model — and they are
          often wrong. They are not betting advice. 18+.
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Match data provided by API-Football. Club badges and competition names are the trademarks
          of their respective owners and are shown only to identify matches; their use implies no
          affiliation or endorsement.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <Link href="/how-predictions-work" className="text-gray-400 hover:text-brand-accent transition-colors">
            How predictions work
          </Link>
          <Link href="/legal/terms" className="text-gray-400 hover:text-brand-accent transition-colors">
            Terms of Use
          </Link>
          <Link href="/legal/privacy" className="text-gray-400 hover:text-brand-accent transition-colors">
            Privacy Policy
          </Link>
          <span className="text-gray-600">© {new Date().getFullYear()} oBetile</span>
        </div>
      </div>
    </footer>
  );
}
