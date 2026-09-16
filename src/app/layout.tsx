import type { Metadata } from "next";
import { Assistant } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-assistant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "סטודיו דב אברמסון | ניהול פרויקטים",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={assistant.variable}>
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
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
