export function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-dark-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-20 bg-dark-muted rounded" />
              <div className="h-3 w-12 bg-dark-muted rounded" />
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-7 w-28 bg-dark-muted rounded" />
            <div className="h-4 w-20 bg-dark-muted rounded" />
          </div>
          <div className="h-2 bg-dark-muted rounded-full mb-4" />
          <div className="h-10 bg-dark-muted rounded mb-4" />
          <div className="flex gap-4">
            <div className="h-3 w-12 bg-dark-muted rounded" />
            <div className="h-3 w-16 bg-dark-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
