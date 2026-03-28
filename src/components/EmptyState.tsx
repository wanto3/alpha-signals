import { Inbox } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-dark-card border border-dark-border flex items-center justify-center mb-4">
        <Inbox size={28} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No opportunities yet</h3>
      <p className="text-gray-400 text-sm max-w-sm">
        Check back soon. We're scanning markets for high-conviction signals.
      </p>
    </div>
  );
}
