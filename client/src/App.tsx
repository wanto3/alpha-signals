import { useEffect, useState } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-200 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Alpha Signals
          </h1>
          <p className="text-gray-400 text-lg">
            High-conviction opportunities dashboard
          </p>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">System Status</h2>

          {loading && (
            <p className="text-gray-400 animate-pulse">Connecting to backend...</p>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-400 font-medium">Connection failed</p>
              <p className="text-red-300/70 text-sm mt-1">
                Make sure the server is running: <code className="bg-red-900/30 px-1 rounded">npm run dev</code>
              </p>
            </div>
          )}

          {health && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 font-medium">Backend connected</span>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="text-white font-medium mt-0.5">{health.status}</dd>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <dt className="text-gray-500">Version</dt>
                  <dd className="text-white font-medium mt-0.5">{health.version}</dd>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3 col-span-2">
                  <dt className="text-gray-500">Last heartbeat</dt>
                  <dd className="text-white font-medium mt-0.5">{new Date(health.timestamp).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="text-center text-gray-500 text-sm">
          Alpha Signals MVP &mdash; Phase 1
        </div>
      </div>
    </div>
  );
}

export default App;
