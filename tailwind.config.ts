import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-assistant)", "Arial", "sans-serif"],
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
