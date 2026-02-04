import { useState, useEffect } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export function useNtfyTopic() {
  const [topic, setTopic] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopic() {
      try {
        const response = await fetch(`${BACKEND_URL}/ntfy/topic`);
        if (response.ok) {
          const data = await response.json();
          setTopic(data.topic);
          setUrl(data.url);
        }
      } catch {
        setTopic("did-sonnet5-drop");
        setUrl("https://ntfy.sh/did-sonnet5-drop");
      }
    }

    fetchTopic();
  }, []);

  return { topic, url };
}
