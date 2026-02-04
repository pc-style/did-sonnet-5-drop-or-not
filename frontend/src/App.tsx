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
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Checking...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">
          <h1>Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {status?.found ? (
        <div className="found">
          <h1>Sonnet 5 has dropped!</h1>
          {status.model && <p className="model">{status.model}</p>}
          {status.source && (
            <p className="source">
              Found at:{" "}
              <a href={status.source} target="_blank" rel="noopener noreferrer">
                {status.source}
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="not-found">
          <h1>Not yet.</h1>
          <p className="waiting">Still waiting for Sonnet 5...</p>
        </div>
      )}
      <div className="timestamp">
        Last checked: {status ? formatTime(status.checkedAt) : "Never"}
      </div>
    </div>
  );
}

export default App;
