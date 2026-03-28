import { useEffect } from 'react';
import { Bell, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'alert' | 'success' | 'error';
  onDismiss: () => void;
}

export function Toast({ message, type = 'alert', onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const colors = {
    alert: 'border-alert bg-alert/10',
    success: 'border-gain bg-gain/10',
    error: 'border-loss bg-loss/10',
  };

  const icons = {
    alert: <Bell className="w-4 h-4 text-alert" />,
    success: <Bell className="w-4 h-4 text-gain" />,
    error: <Bell className="w-4 h-4 text-loss" />,
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-bg-surface border ${colors[type]} rounded-lg px-4 py-3 shadow-xl animate-in slide-in-from-right`}>
      {icons[type]}
      <span className="text-text-primary text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="text-text-secondary hover:text-text-primary ml-1">
        <X size={16} />
      </button>
    </div>
  );
}
