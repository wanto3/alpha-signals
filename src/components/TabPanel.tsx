import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  component: React.ReactNode;
}

interface TabPanelProps {
  tabs: Tab[];
}

export function TabPanel({ tabs }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border-subtle">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tabs.find(t => t.id === activeTab)?.component}
      </div>
    </div>
  );
}
