import { useEffect, useState } from "react";
import "./App.css";

interface StatusData {
  found: boolean;
  model: string | null;
  source: string | null;
  checkedAt: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

function App() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`${BACKEND_URL}/status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StatusData = await res.json();
        setStatus(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch status");
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div className="ambient">
        <div className="ambient-orb ambient-orb--1" />
        <div className="ambient-orb ambient-orb--2" />
        <div className="ambient-orb ambient-orb--3" />
      </div>
      <div className="grain" />

      <div className="container">
        <div className="content">
          {loading ? (
            <div className="loading">
              <div className="loading-spinner" />
              <p className="loading-text">Checking Anthropic...</p>
            </div>
          ) : error ? (
            <div className="error">
              <h1>Connection Error</h1>
              <p>{error}</p>
            </div>
          ) : (
            <div className="status-card">
              {status?.found ? (
                <div className="found">
                  <div className="status-badge">
                    <span className="status-badge-dot" />
                    Released
                  </div>
                  <h1>
                    <span>Sonnet 5</span> has arrived
                  </h1>
                  {status.model && <div className="model-tag">{status.model}</div>}
                  {status.source && (
                    <p className="source-link">
                      <a href={status.source} target="_blank" rel="noopener noreferrer">
                        View announcement
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <div className="not-found">
                  <h1>Not yet</h1>
                  <p className="subtitle">Still waiting for Claude Sonnet 5</p>
                  <div className="waiting-indicator">
                    <div className="waiting-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Checking every 10 seconds</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <div className="timestamp">
          Last checked: {status ? formatTime(status.checkedAt) : "--:--"}
        </div>
        <div className="live-indicator">
          <span className="live-dot" />
          Live
        </div>
      </footer>
    </>
  );
}

export default App;
