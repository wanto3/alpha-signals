import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message = 'Failed to load opportunities', onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-signal-sell/10 border border-signal-sell/20 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-signal-sell" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Something went wrong</h3>
      <p className="text-gray-400 text-sm mb-6 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="btn-primary flex items-center gap-2"
      >
        <RefreshCw size={14} />
        Try Again
      </button>
    </div>
  );
}
