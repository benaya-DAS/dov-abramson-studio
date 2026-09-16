"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function TimeTracker({
  itemId,
  userId,
  baseSeconds,
  readOnly,
}: {
  itemId: string;
  userId: string | null;
  baseSeconds: number;
  readOnly?: boolean;
}) {
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createClient();
    // Fetch-on-mount to resume showing an in-progress timer after a reload.
    supabase
      .from("time_logs")
      .select("id, started_at")
      .eq("item_id", itemId)
      .eq("user_id", userId)
      .is("ended_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setActiveLogId(data.id);
        setStartedAt(new Date(data.started_at).getTime());
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, userId]);

  useEffect(() => {
    if (!activeLogId || !startedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeLogId, startedAt]);

  const totalSeconds = baseSeconds + elapsedSeconds;

  async function toggle() {
    if (!userId || readOnly || loading) return;
    setLoading(true);
    const supabase = createClient();

    if (activeLogId) {
      await supabase.rpc("stop_time_log", { p_log_id: activeLogId });
      setActiveLogId(null);
      setStartedAt(null);
    } else {
      const { data, error } = await supabase
        .from("time_logs")
        .insert({ item_id: itemId, user_id: userId })
        .select("id, started_at")
        .single();
      if (!error && data) {
        setActiveLogId(data.id);
        setStartedAt(new Date(data.started_at).getTime());
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
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40",
          activeLogId ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
        )}
        title={activeLogId ? "עצירת מדידת זמן" : "התחלת מדידת זמן"}
      >
        {activeLogId ? <Square size={11} fill="white" /> : <Play size={11} fill="white" />}
      </button>
      <span
        className={cn(
          "min-w-[64px] text-center font-mono text-xs tabular-nums",
          activeLogId ? "font-semibold text-rose-600" : "text-slate-500"
        )}
      >
        {formatDuration(totalSeconds)}
      </span>
    </div>
  );
}
