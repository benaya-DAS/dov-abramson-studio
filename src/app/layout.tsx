import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "סטודיו דוב אברמסון | ניהול פרויקטים",
  description: "מערכת ניהול הסטודיו - לוחות, משימות, זמנים וקטלוג פרויקטים",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

// Sets the `dark` class on <html> before React hydrates (and before first
// paint), by running inline and synchronously as the document streams in -
// a regular useEffect-based toggle would only flip the class AFTER
// hydration, so every page load would flash light mode first for anyone
// who'd chosen dark. Reads an explicit saved choice; falls back to the OS
// preference only when the visitor has never toggled here before.
const THEME_INIT_SCRIPT = `
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above can add the `dark` class
    // to this element before React hydrates, which legitimately makes the
    // live DOM differ from the server-rendered markup React expects - a
    // false-positive mismatch for React to warn about, since it's this
    // exact script's job to do that.
    <html lang="he" dir="rtl" className={assistant.variable} suppressHydrationWarning>
      <head>
        {/* "Google Sans" isn't in next/font/google's bundled metadata for
            this Next.js version, so it can't be self-hosted like Assistant
            below — loaded from the public Google Fonts CDN instead. Verified
            directly against fonts.googleapis.com before adding this: the
            family is real and does ship a Hebrew subset, so this app's
            RTL Hebrew text is not at risk of silently falling back to a
            glyph-less font. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- that
            rule targets Pages Router page files, where a <link> only loads
            for the one page it's declared in; this is the App Router ROOT
            layout, which every route renders through, so it's already the
            single, app-wide place this belongs. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
