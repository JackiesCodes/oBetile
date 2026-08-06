/** @type {import('next').NextConfig} */

// Content-Security-Policy. Kept deliberately tight: this app loads no third-party
// scripts. 'unsafe-inline' on style-src is required by Tailwind's runtime style
// injection, and script-src needs 'unsafe-inline'/'unsafe-eval' for Next's
// hydration bootstrap in development only.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // app/globals.css @imports Rajdhani + Inter from Google Fonts, which serves
  // the stylesheet from fonts.googleapis.com and the woff2 files from
  // fonts.gstatic.com. Omitting either leaves the site rendering in fallback
  // system fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Team/league/player crests are served from API-Football's media CDN.
  "img-src 'self' data: blob: https://media.api-sports.io",
  // Supabase is reached directly from the browser for auth and community data.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-braces with frame-ancestors, for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
