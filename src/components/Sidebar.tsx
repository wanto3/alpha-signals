import { Zap, TrendingUp, Bell, Settings, BarChart2, ChevronRight } from 'lucide-react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: <Zap size={18} />, label: 'Alpha', active: true },
  { icon: <TrendingUp size={18} />, label: 'Opportunities' },
  { icon: <BarChart2 size={18} />, label: 'Markets' },
  { icon: <Bell size={18} />, label: 'Alerts', badge: 3 },
];

const bottomNav: NavItem[] = [
  { icon: <Settings size={18} />, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-16 md:w-56 bg-dark-surface border-r border-dark-border flex flex-col h-screen sticky top-0 flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="hidden md:block text-white font-bold text-sm tracking-tight">Alpha Signals</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 text-left ${
              item.active
                ? 'bg-accent-primary/10 text-accent-glow border border-accent-primary/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-dark-card'
            }`}
          >
            {item.icon}
            <span className="hidden md:block text-sm font-medium flex-1">{item.label}</span>
            {item.badge && (
              <span className="hidden md:flex items-center justify-center w-5 h-5 rounded-full bg-signal-sell text-white text-xs font-bold">
                {item.badge}
              </span>
            )}
            {!item.active && <ChevronRight size={14} className="hidden md:block text-dark-muted ml-auto" />}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-dark-border space-y-0.5">
        {bottomNav.map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-dark-card transition-colors duration-150"
          >
            {item.icon}
            <span className="hidden md:block text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
