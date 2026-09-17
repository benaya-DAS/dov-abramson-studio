"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import TimeLogPopover from "./TimeLogPopover";
import type { ActiveTimeLog, Profile } from "@/lib/supabase/types";

function secondsSince(isoStart: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000));
}

export default function TimeTracker({
  itemId,
  userId,
  profiles,
  baseSeconds,
  activeSessions,
  onTimeLogChanged,
  readOnly,
}: {
  itemId: string;
  userId: string | null;
  profiles: Profile[];
  /** Sum of completed sessions for this item, across every studio member. */
  baseSeconds: number;
  /** Every currently-running (no end_time yet) session on this item, from
   * every studio member — sourced centrally in BoardWorkspace and kept
   * live via its realtime subscription on time_logs. */
  activeSessions: ActiveTimeLog[];
  /** Re-fetches trackedSecondsByItem/activeSessionsByItem in BoardWorkspace
   * immediately. Called right after a successful start/stop so the total
   * updates without waiting on the realtime round-trip — belt-and-braces
   * alongside the subscription, not a replacement for it (other viewers'
   * screens still depend on realtime actually being wired up). */
  onTimeLogChanged: () => void;
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationButtonRef = useRef<HTMLButtonElement>(null);

  // A failed start/stop request used to fail completely silently (console
  // only) - the on-screen button would just snap back, which reads as
  // "nothing happened". Surface it as a brief red state on the button
  // itself, self-clearing so it doesn't linger forever.
  useEffect(() => {
    if (!errorMsg) return;
    errorTimeoutRef.current = setTimeout(() => setErrorMsg(null), 5000);
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [errorMsg]);

  // Any team member can stop a running timer on an item, not just whoever
  // started it (stop_time_log is security definer server-side for exactly
  // this) - so the button's target session is MY OWN active session if I
  // have one on this item, and otherwise whichever teammate's session is
  // running, not just "mine or nothing". Starting a NEW session still
  // always starts one for the current viewer, regardless of whose is
  // showing.
  //
  // stoppingOverrideId / startingOverride optimistically hide a
  // just-stopped session / show a just-started one before the realtime
  // round-trip confirms it, keyed by session id (not "mine") so this works
  // the same whether the stopped session was mine or a teammate's.
  // Reconciled during render (React's documented pattern for "adjusting
  // state when a prop changes") rather than in an effect: once
  // activeSessions itself reflects the change, the override clears
  // immediately, in the same commit, instead of one tick later.
  const [stoppingOverrideId, setStoppingOverrideId] = useState<string | null>(null);
  const [startingOverride, setStartingOverride] = useState<ActiveTimeLog | null>(null);

  const stoppedSessionGone = stoppingOverrideId
    ? !activeSessions.some((s) => s.id === stoppingOverrideId)
    : false;
  const [wasStoppedSessionGone, setWasStoppedSessionGone] = useState(stoppedSessionGone);
  if (stoppedSessionGone !== wasStoppedSessionGone) {
    setWasStoppedSessionGone(stoppedSessionGone);
    if (stoppedSessionGone) setStoppingOverrideId(null);
  }

  const startedSessionConfirmed = startingOverride
    ? activeSessions.some((s) => s.id === startingOverride.id)
    : false;
  const [wasStartedSessionConfirmed, setWasStartedSessionConfirmed] = useState(
    startedSessionConfirmed
  );
  if (startedSessionConfirmed !== wasStartedSessionConfirmed) {
    setWasStartedSessionConfirmed(startedSessionConfirmed);
    if (startedSessionConfirmed) setStartingOverride(null);
  }

  const allActiveSessions = useMemo(() => {
    let list = activeSessions.filter((s) => s.id !== stoppingOverrideId);
    if (startingOverride && !list.some((s) => s.id === startingOverride.id)) {
      list = [startingOverride, ...list];
    }
    return list;
  }, [activeSessions, stoppingOverrideId, startingOverride]);

  // Mine takes priority as the button's target if I have one running;
  // otherwise the first other active session (realistically there's at
  // most one, since a user can only ever have one running timer anywhere
  // in the app - see time_logs_one_active_per_user).
  const targetSession =
    allActiveSessions.find((s) => s.user_id === userId) ?? allActiveSessions[0] ?? null;
  const targetIsMine = !!targetSession && targetSession.user_id === userId;
  const activeKey = allActiveSessions.map((s) => s.id).join(",");

  // liveSeconds is real state, recomputed only inside the effect below —
  // never derived directly from Date.now() during render. Calling
  // Date.now() in the render body is non-deterministic between the server
  // render and the client hydration render (SSR always renders this
  // component, since it isn't dynamically imported with ssr:false), which
  // produces a hydration mismatch: the server's snapshot of "now" and the
  // client's differ, so the server-rendered duration text doesn't match
  // what the client recomputes, and React discards and regenerates the
  // whole tree. Starting at 0 and only updating post-mount, inside an
  // effect, keeps the server and initial client render identical.
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!activeKey) {
      // Syncs the visible timer to zero when no session is running —
      // that's the whole point of this effect, not incidental derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveSeconds(0);
      return;
    }
    function tick() {
      setLiveSeconds(allActiveSessions.reduce((sum, s) => sum + secondsSince(s.start_time), 0));
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // allActiveSessions is intentionally omitted: it's a new array each
    // render, but its contents (start_time per id) don't change without
    // activeKey (the set of ids) also changing, so re-keying on activeKey
    // alone avoids tearing down/rebuilding the interval every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const totalSeconds = baseSeconds + liveSeconds;

  async function toggle() {
    if (!userId || readOnly || loading) return;
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    // try/catch/finally matters here beyond the usual reflex: supabase-js
    // resolves to { error } for ordinary request failures, but a lower-level
    // failure (network drop, CORS, an ad/tracking blocker on the request)
    // rejects the promise instead. Without a catch, that throw would skip
    // setLoading(false) entirely and leave the button permanently disabled
    // - which looks exactly like "clicking does nothing" with zero clue why.
    try {
      if (targetSession) {
        const stoppingId = targetSession.id;
        setStoppingOverrideId(stoppingId);
        const { data, error } = await supabase.rpc("stop_time_log", { p_log_id: stoppingId });
        if (error) {
          console.error("Failed to stop time session:", error);
          setErrorMsg(error.message);
          setStoppingOverrideId(null);
        } else if (!data) {
          // No SQL error, but stop_time_log's UPDATE matched zero rows (the
          // session was already stopped elsewhere, or the board got
          // archived out from under it) - treat that as a failure too
          // instead of silently trusting an optimistic update that didn't
          // actually land.
          console.error("Failed to stop time session: no matching active session on the server");
          setErrorMsg("לא ניתן היה לעצור את המדידה (יתכן שכבר נעצרה)");
          setStoppingOverrideId(null);
          onTimeLogChanged();
        } else {
          onTimeLogChanged();
        }
      } else {
        const { data, error } = await supabase
          .from("time_logs")
          .insert({ item_id: itemId, user_id: userId })
          .select("id, user_id, start_time")
          .single();
        if (error) {
          console.error("Failed to start time session:", error);
          setErrorMsg(error.message);
        } else if (data) {
          setStartingOverride(data);
          onTimeLogChanged();
        }
      }
    } catch (err) {
      console.error("Time tracking request failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "שגיאת רשת");
      setStoppingOverrideId(null);
    } finally {
      setLoading(false);
    }
  }

  const otherRunnerName = targetSession && !targetIsMine
    ? profiles.find((p) => p.id === targetSession.user_id)?.full_name ||
      profiles.find((p) => p.id === targetSession.user_id)?.email ||
      "עמית/ה לצוות"
    : null;
  const stopTitle = otherRunnerName ? `עצירת המדידה של ${otherRunnerName}` : "עצירת מדידת זמן";

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={toggle}
        disabled={readOnly || !userId || loading}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-90 disabled:opacity-40",
          errorMsg ? "bg-red-500 ring-2 ring-red-300" : targetSession ? "bg-[#579bfc]" : "bg-emerald-500"
        )}
        title={errorMsg ?? (targetSession ? stopTitle : "התחלת מדידת זמן")}
      >
        {targetSession ? <Pause size={11} fill="white" /> : <Play size={11} fill="white" />}
      </button>
      <button
        ref={durationButtonRef}
        onClick={() => setLogOpen((o) => !o)}
        className={cn(
          "min-w-[64px] rounded px-1 text-center font-mono text-xs tabular-nums hover:bg-slate-100 dark:hover:bg-night-700",
          targetSession ? "font-semibold text-[#579bfc]" : "text-slate-500 dark:text-slate-400"
        )}
        title="יומן מעקב זמן"
      >
        {formatDuration(totalSeconds)}
      </button>

      {logOpen && (
        <TimeLogPopover
          anchorRef={durationButtonRef}
          itemId={itemId}
          currentUserId={userId}
          profiles={profiles}
          totalSeconds={totalSeconds}
          readOnly={readOnly}
          onClose={() => setLogOpen(false)}
          onChanged={onTimeLogChanged}
        />
      )}
    </div>
  );
}
