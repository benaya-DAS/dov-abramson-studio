"use client";

import { useEffect, useRef, useState } from "react";
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
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationButtonRef = useRef<HTMLButtonElement>(null);

  const myActiveFromProps = activeSessions.find((s) => s.user_id === userId) ?? null;
  const propsActiveId = myActiveFromProps?.id ?? null;

  // Optimistic override for the viewer's OWN play/pause click, so the
  // button and total flip instantly instead of waiting on a realtime
  // round-trip. `undefined` means "no override, trust activeSessions".
  // Reconciled during render (React's documented pattern for "adjusting
  // state when a prop changes") rather than in an effect: once
  // activeSessions itself reflects what we optimistically set, the
  // override is cleared immediately, in the same commit, instead of one
  // tick later.
  const [myActiveOverride, setMyActiveOverride] = useState<ActiveTimeLog | null | undefined>(
    undefined
  );
  const [reconciledPropsId, setReconciledPropsId] = useState(propsActiveId);
  if (propsActiveId !== reconciledPropsId) {
    setReconciledPropsId(propsActiveId);
    if (myActiveOverride !== undefined && (myActiveOverride?.id ?? null) === propsActiveId) {
      setMyActiveOverride(undefined);
    }
  }

  const myActive = myActiveOverride !== undefined ? myActiveOverride : myActiveFromProps;
  const otherActiveSessions = activeSessions.filter((s) => s.user_id !== userId);
  const allActiveSessions = myActive ? [myActive, ...otherActiveSessions] : otherActiveSessions;
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
    const supabase = createClient();

    if (myActive) {
      setMyActiveOverride(null);
      const { error } = await supabase.rpc("stop_time_log", { p_log_id: myActive.id });
      if (error) {
        console.error("Failed to stop time session:", error);
        setMyActiveOverride(undefined);
      }
    } else {
      const { data, error } = await supabase
        .from("time_logs")
        .insert({ item_id: itemId, user_id: userId })
        .select("id, user_id, start_time")
        .single();
      if (error) {
        console.error("Failed to start time session:", error);
      } else if (data) {
        setMyActiveOverride(data);
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={toggle}
        disabled={readOnly || !userId || loading}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-90 disabled:opacity-40",
          myActive ? "bg-[#579bfc]" : "bg-emerald-500"
        )}
        title={myActive ? "עצירת מדידת זמן" : "התחלת מדידת זמן"}
      >
        {myActive ? <Pause size={11} fill="white" /> : <Play size={11} fill="white" />}
      </button>
      <button
        ref={durationButtonRef}
        onClick={() => setLogOpen((o) => !o)}
        className={cn(
          "min-w-[64px] rounded px-1 text-center font-mono text-xs tabular-nums hover:bg-slate-100",
          myActive ? "font-semibold text-[#579bfc]" : "text-slate-500"
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
        />
      )}
    </div>
  );
}
