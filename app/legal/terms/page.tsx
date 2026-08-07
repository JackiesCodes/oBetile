import Link from "next/link";

export const metadata = {
  title: "Terms of Use — oBetile",
  description: "The terms you agree to when using oBetile.",
};

export default function TermsPage() {
  return (
    <main>
      <h1 className="text-white text-2xl font-bold mb-1">Terms of Use</h1>
      <p className="text-gray-500 text-xs mb-6">Last updated 7 August 2026</p>

      <p>By using oBetile you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What oBetile is — and is not</h2>
      <p>
        oBetile is a <strong>free football information and predictions site</strong>. You can follow
        fixtures and results, see win percentages, record predictions for your own interest, and
        discuss matches with other users.
      </p>
      <p>
        <strong>oBetile is not a betting operator and does not offer gambling.</strong> No money can
        be deposited, staked, won or withdrawn. Predictions you record carry no stake and no prize.
        We are not affiliated with, endorsed by, or connected to any bookmaker, betting company or
        sports organisation.
      </p>

      <h2>Accuracy — please read</h2>
      <p>
        Win percentages shown on the site are derived from publicly available bookmaker prices,
        converted into implied probabilities. <strong>They are estimates, not forecasts of what will
        happen</strong>, and they are frequently wrong. Fixtures, scores, line-ups and standings come
        from a third-party data provider and may be delayed, incomplete or inaccurate.
      </p>
      <p>
        Nothing on oBetile is betting advice or a recommendation to gamble. Do not rely on anything
        here to place a bet or make any financial decision. If you choose to gamble elsewhere, you do
        so entirely at your own risk, and we accept no liability for any loss.
      </p>

      <h2>Age</h2>
      <p>
        You must be <strong>18 or over</strong> to create an account. Although we offer no gambling,
        the site covers betting-adjacent subject matter and is not intended for children.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your password to yourself; you are responsible for activity under your account. Tell us
        promptly if you think someone else has access. You may delete your account at any time from
        your profile page.
      </p>

      <h2>Community rules</h2>
      <p>You are responsible for what you post. Do not post:</p>
      <ul>
        <li>Anything unlawful, hateful, harassing, or that threatens or defames anyone.</li>
        <li>Spam, scams, or advertising — including promotion of gambling services.</li>
        <li>Anyone&apos;s personal information, including your own contact details.</li>
        <li>Content you do not have the right to share.</li>
      </ul>
      <p>
        We may remove content or suspend accounts that break these rules. Posting is rate limited to
        keep the site usable for everyone.
      </p>

      <h2>Data and intellectual property</h2>
      <p>
        Match data is licensed from a third-party provider and remains theirs. Club badges, team
        names and competition names are the trademarks of their respective owners, shown here purely
        to identify the match being described. Their appearance implies no affiliation or endorsement.
      </p>
      <p>
        The site&apos;s own design and code belong to us. Content you post remains yours; by posting it
        you give us permission to display it on the site.
      </p>

      <h2>Availability</h2>
      <p>
        oBetile is provided free and as-is. We do not promise it will always be available, accurate or
        error-free, and we may change or discontinue any part of it. To the fullest extent the law
        allows, we are not liable for any loss arising from your use of the site.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:mashabealbin022@gmail.com">mashabealbin022@gmail.com</a>
      </p>

      <p className="mt-8 text-xs text-gray-500">
        See also our <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
