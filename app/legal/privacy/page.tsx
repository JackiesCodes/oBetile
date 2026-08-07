import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — oBetile",
  description: "What personal data oBetile collects, why, and how to remove it.",
};

/**
 * Written from what the application actually does rather than from a template.
 * If the data flows change — a new table holding personal data, an analytics
 * script, an advertising network, a new sub-processor — this page has to change
 * with them, or it becomes a false statement rather than an out-of-date one.
 */
export default function PrivacyPage() {
  return (
    <main>
      <h1 className="text-white text-2xl font-bold mb-1">Privacy Policy</h1>
      <p className="text-gray-500 text-xs mb-6">Last updated 7 August 2026</p>

      <p>
        oBetile is a free football predictions and community site. This page explains exactly
        what personal data we hold, why we hold it, who can see it, and how to get rid of it.
      </p>

      <h2>What we collect</h2>
      <p>You can browse fixtures, scores, standings and win percentages without an account. We collect nothing beyond ordinary server logs until you sign up.</p>
      <p>If you create an account, we store:</p>
      <ul>
        <li><strong>Your email address and password</strong> — handled by our authentication provider. Passwords are hashed; we never see or store them in readable form.</li>
        <li><strong>A username and avatar URL</strong>, if you set them.</li>
        <li><strong>Your activity</strong> — the predictions you save, leagues you favourite, match outcome votes you cast, and community posts and likes.</li>
      </ul>
      <p>
        We do <strong>not</strong> collect payment details, we do not ask for your real name,
        date of birth, address or phone number, and we do not buy or receive personal data
        about you from anyone else.
      </p>

      <h2>Why we hold it</h2>
      <ul>
        <li>Your email and password exist so you can log in and recover access.</li>
        <li>Your username and avatar identify you on community posts you choose to publish.</li>
        <li>Your saved predictions, favourites and votes exist so the site can show them back to you and display aggregate community sentiment on a match.</li>
      </ul>

      <h2>What other people can see</h2>
      <p>
        Community posts and the username and avatar attached to them are <strong>public</strong> —
        anyone visiting the site can read them, signed in or not. Match votes are public in
        aggregate only: others see the totals, not who voted which way.
      </p>
      <p>
        Your email address, your saved predictions and your favourites are <strong>private</strong>.
        Database access rules restrict every one of those records to your own account.
      </p>

      <h2>Cookies</h2>
      <p>
        We set one kind of cookie: the session cookie that keeps you signed in, refreshed on each
        request so your session does not expire mid-visit. It is strictly necessary for logging in
        and is removed when you sign out.
      </p>
      <p>
        We run <strong>no analytics, no advertising and no third-party trackers</strong>. The site&apos;s
        content security policy blocks scripts from any other origin, so third-party tracking cannot
        be added without a deliberate code change.
      </p>

      <h2>Who processes your data</h2>
      <ul>
        <li><strong>Supabase</strong> — database and authentication. Your account and activity are stored here.</li>
        <li><strong>Vercel</strong> — hosting. Processes requests and keeps standard server logs.</li>
        <li><strong>API-Football</strong> — the source of fixtures, scores, standings and odds. This is a one-way feed: <em>no personal data about you is ever sent to them.</em></li>
        <li><strong>Google Fonts</strong> — serves the site&apos;s two webfonts, which means your browser contacts Google to fetch them.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Until you delete it. Your account and everything attached to it stay while the account is
        open. Deleting your account removes the lot immediately and permanently — see below.
      </p>

      <h2>Your rights</h2>
      <p>You can, at any time:</p>
      <ul>
        <li><strong>See and correct</strong> your profile from your <Link href="/profile">profile page</Link>.</li>
        <li><strong>Delete everything.</strong> The Delete Account button on your profile page permanently removes your account, profile, saved predictions, favourites, votes, posts and likes. It cannot be undone and we keep no copy.</li>
        <li><strong>Ask us anything</strong> about the data we hold, using the contact address below.</li>
      </ul>
      <p>
        Depending on where you live you may have further rights — such as obtaining a copy of your
        data or objecting to how it is used. Contact us and we will honour them.
      </p>

      <h2>Children</h2>
      <p>
        oBetile is not intended for anyone under 18. We do not knowingly collect data from children.
        If you believe a child has created an account, contact us and we will remove it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change what we collect or who processes it, we will update this page and its date. We
        will not quietly start collecting more than is described here.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data, or a request to exercise any right above:{" "}
        <a href="mailto:mashabealbin022@gmail.com">mashabealbin022@gmail.com</a>.
      </p>

      <p className="mt-8 text-xs text-gray-500">
        See also our <Link href="/legal/terms">Terms of Use</Link>.
      </p>
    </main>
  );
}
