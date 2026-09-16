import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    // STATUS_COLORS/GROUP_COLORS in src/lib/constants.ts hold Tailwind class
    // name strings (e.g. "bg-rose-700") that only ever appear as string
    // values, never as literal JSX class text in app/ or components/.
    // Tailwind's JIT compiler only emits CSS for classes it can find by
    // scanning these globs as plain text - a class that exists ONLY in a
    // file outside them is silently never generated, no error, nothing
    // "broken" to see in devtools except an element with no background at
    // all. This was the actual, root cause of the status badge contrast
    // bug across every previous attempt to fix it by changing the color
    // values: the values were always correct, the CSS for them just never
    // shipped.
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // "Google Sans" loads from the public Google Fonts CDN (a <link>
        // in layout.tsx — it isn't in this Next.js version's next/font/google
        // metadata yet, so it can't be self-hosted the way Assistant is).
        // Assistant (self-hosted, zero extra network request, already has a
        // Hebrew subset) stays as the fallback for the brief window before
        // the external stylesheet loads, and as a safety net if it ever
        // fails to load at all — RTL Hebrew text must never fall through to
        // a font with no Hebrew glyphs.
        sans: ["'Google Sans'", "var(--font-assistant)", "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        status: {
          notStarted: "#c4c4c4",
          working: "#fdab3d",
          stuck: "#e2445c",
          done: "#00c875",
        },
      },
      boxShadow: {
        panel: "0 1px 3px 0 rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
