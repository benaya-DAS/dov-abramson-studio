"use client";

import { useEffect, useState } from "react";
import type { ActiveTimeLog } from "@/lib/supabase/types";

/** A single running session past this is probably a forgotten timer. */
export const LONG_RUNNING_SECONDS = 10 * 3600;

/**
 * How long the longest of these running sessions has gone, in seconds -
 * but only once it's past LONG_RUNNING_SECONDS; null otherwise. Per
 * session, not the item's total: a long total is normal, one uninterrupted
 * 10h+ session isn't.
 *
 * Computed in an effect (and re-checked every 30s), never from Date.now()
 * during render - same hydration reason as TimeTracker's liveSeconds.
 */
export function useLongRunningTimer(sessions: ActiveTimeLog[]): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  const key = sessions.map((s) => `${s.id}@${s.start_time}`).join(",");

  useEffect(() => {
    function check() {
      const longest = sessions.reduce(
        (max, s) => Math.max(max, (Date.now() - new Date(s.start_time).getTime()) / 1000),
        0
      );
      setSeconds(longest >= LONG_RUNNING_SECONDS ? Math.floor(longest) : null);
    }
    check();
    if (!sessions.length) return;
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
    // `key` captures everything about `sessions` that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return seconds;
}
