import { useEffect, useState } from "react";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useNtfyTopic } from "./hooks/useNtfyTopic";
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
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);

  const push = usePushNotifications();
  const ntfy = useNtfyTopic();

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

              <div className="notify-section">
                <button
                  className="notify-toggle"
                  onClick={() => setShowNotifyPanel(!showNotifyPanel)}
                >
                  <BellIcon />
                  <span>Get notified when it drops</span>
                  <ChevronIcon open={showNotifyPanel} />
                </button>

                {showNotifyPanel && (
                  <div className="notify-panel">
                    <div className="notify-option">
                      <div className="notify-option-header">
                        <span className="notify-option-icon">
                          <BrowserIcon />
                        </span>
                        <div className="notify-option-info">
                          <span className="notify-option-title">Browser Push</span>
                          <span className="notify-option-desc">Instant notification</span>
                        </div>
                      </div>
                      {push.state === "unsupported" ? (
                        <span className="notify-status muted">Not supported</span>
                      ) : push.state === "denied" ? (
                        <span className="notify-status muted">Blocked</span>
                      ) : push.state === "loading" ? (
                        <span className="notify-status">...</span>
                      ) : push.state === "subscribed" ? (
                        <button className="notify-btn active" onClick={push.unsubscribe}>
                          Enabled
                        </button>
                      ) : (
                        <button className="notify-btn" onClick={push.subscribe}>
                          Enable
                        </button>
                      )}
                    </div>

                    <div className="notify-divider" />

                    <div className="notify-option">
                      <div className="notify-option-header">
                        <span className="notify-option-icon">
                          <PhoneIcon />
                        </span>
                        <div className="notify-option-info">
                          <span className="notify-option-title">ntfy.sh</span>
                          <span className="notify-option-desc">iOS/Android app</span>
                        </div>
                      </div>
                      <a
                        href={ntfy.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="notify-btn"
                      >
                        Subscribe
                      </a>
                    </div>

                    {ntfy.topic && (
                      <div className="notify-topic">
                        Topic: <code>{ntfy.topic}</code>
                      </div>
                    )}

                    {push.error && <div className="notify-error">{push.error}</div>}
                  </div>
                )}
              </div>
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

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function BrowserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  );
}

export default App;
