// Shown the instant a board link is clicked, while the server loads the
// board - so switching boards responds immediately instead of the old board
// sitting frozen on screen. Next prefetches this loading state along with
// the sidebar's <Link>s, so it appears with no round trip at all.
// Deliberately minimal: a title line and two plain group blocks.

function GroupBlock({ height }: { height: string }) {
  return (
    <div className="mb-6">
      <div className="mb-2 h-4 w-32 rounded bg-slate-200 dark:bg-night-700" />
      <div className={`${height} rounded-lg bg-slate-200/70 dark:bg-night-800`} />
    </div>
  );
}

export default function BoardLoading() {
  return (
    <div className="animate-pulse p-5" aria-busy="true" aria-label="טוען את הבורד">
      <div className="mb-8 h-6 w-48 rounded bg-slate-200 dark:bg-night-700" />
      <GroupBlock height="h-48" />
      <GroupBlock height="h-28" />
    </div>
  );
}
