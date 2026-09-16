"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  // The real theme is already decided (by the inline script in
  // layout.tsx, which runs before hydration) by the time this component
  // mounts - `mounted` just guards against rendering an icon on the
  // server that doesn't match what's actually on <html> yet, since the
  // server has no way to know the visitor's saved preference.
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Reads the DOM (an external system, set by the inline script in
    // layout.tsx before hydration) exactly once on mount - there's no
    // React state or prop this could be derived from instead, since the
    // server has no way to know the visitor's saved theme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private-browsing/storage-blocked: the toggle still works for this
      // page load, it just won't be remembered on the next visit.
    }
  }

  if (!mounted) {
    // Same footprint as the real button, so nothing shifts into place
    // once mounted flips true.
    return <div className="h-9 w-9 shrink-0" aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
      aria-label={isDark ? "מעבר למצב בהיר" : "מעבר למצב כהה"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
