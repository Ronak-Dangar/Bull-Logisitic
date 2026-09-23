// Shown instantly on navigation while the next page's server data loads.
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="h-6 w-40 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-3">
        <div className="flex gap-2">
          <div className="h-10 flex-1 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-10 w-36 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
