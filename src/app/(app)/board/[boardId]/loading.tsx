// Shown the instant a board link is clicked, while the server loads the
// board - so switching boards responds immediately instead of the old board
// sitting frozen on screen. Next prefetches this loading state along with
// the sidebar's <Link>s, so it appears with no round trip at all. A rough,
// pulsing outline of BoardWorkspace: header, view tabs, filter bar, then
// two groups of rows.

function Bar({ className }: { className: string }) {
  return <div className={`rounded bg-slate-200 dark:bg-night-700 ${className}`} />;
}

function GroupSkeleton({ rows, color }: { rows: number; color: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 rounded-t-lg px-3 py-2.5" style={{ backgroundColor: `${color}1a` }}>
        <div className="h-4 w-4 rounded" style={{ backgroundColor: `${color}66` }} />
        <Bar className="h-4 w-32" />
        <Bar className="mr-auto h-3 w-14" />
      </div>
      <div className="overflow-hidden rounded-b-lg border border-t-0 border-slate-300 dark:border-night-500">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-night-500 dark:bg-night-800/60">
          <Bar className="h-2.5 w-24" />
          <Bar className="h-2.5 w-12" />
          <Bar className="h-2.5 w-20" />
          <Bar className="hidden h-2.5 w-16 md:block" />
          <Bar className="hidden h-2.5 w-12 md:block" />
          <Bar className="hidden h-2.5 w-20 md:block" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0 dark:border-night-500"
          >
            <div className="h-4 w-4 shrink-0 rounded border border-slate-300 dark:border-night-600" />
            <Bar className={`h-3.5 ${["w-44", "w-36", "w-52", "w-40"][i % 4]}`} />
            <div className="h-6 w-6 shrink-0 rounded-full bg-slate-200 dark:bg-night-700" />
            <Bar className="hidden h-3 w-24 md:block" />
            <Bar className="h-6 w-24 rounded-md" />
            <Bar className="hidden h-3 w-14 md:block" />
            <Bar className="hidden h-3 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BoardLoading() {
  return (
    <div className="flex h-full animate-pulse flex-col" aria-busy="true" aria-label="טוען את הבורד">
      <div className="px-5 pt-4">
        <Bar className="mb-2 h-3 w-20" />
        <Bar className="h-6 w-56" />
      </div>
      <div className="mt-4 hidden items-center gap-5 border-b border-slate-200 px-5 pb-2.5 dark:border-night-700 md:flex">
        <Bar className="h-3.5 w-12" />
        <Bar className="h-3.5 w-12" />
        <Bar className="h-3.5 w-14" />
      </div>
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-2.5 dark:border-night-700">
        <Bar className="h-7 w-48 rounded-md" />
        <Bar className="hidden h-7 w-24 rounded-md md:block" />
        <Bar className="hidden h-7 w-24 rounded-md md:block" />
      </div>
      <div className="p-5">
        <GroupSkeleton rows={4} color="#579bfc" />
        <GroupSkeleton rows={2} color="#a25ddc" />
      </div>
    </div>
  );
}
