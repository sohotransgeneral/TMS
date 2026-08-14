/**
 * Shown while the driver page is being rendered for a new period.
 *
 * Without it the previous period's figures stay on screen until the new ones
 * arrive — and stale numbers that look live are worse than an obvious wait
 * when someone is deciding what to pay a driver.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading driver report">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-6">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="flex justify-between gap-4">
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
