import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  initWebPush,
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  notifySonnet5Dropped,
  type PushSubscription,
} from "./notifications.js";

const app = new Hono();

interface StatusData {
  found: boolean;
  model: string | null;
  source: string | null;
  checkedAt: string;
}

let lastStatus: StatusData = {
  found: false,
  model: null,
  source: null,
  checkedAt: new Date().toISOString(),
};

let lastEtag: string | null = null;
let isChecking = false;
let previouslyFound = false;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SONNET_5_PATTERNS = [
  /\bclaude[-_]?5[-_]?sonnet\b/i,
  /\bsonnet[-_]?5\b/i,
  /\bclaude[-_]?sonnet[-_]?5\b/i,
];

const EXCLUDE_PATTERNS = [
  /\bclaude[-_]?3[-_.]?5[-_]?sonnet\b/i,
  /\bclaude[-_]?4[-_.]?5[-_]?sonnet\b/i,
  /\bsonnet[-_]?3[-_.]?5\b/i,
  /\bsonnet[-_]?4[-_.]?5\b/i,
  /\b3\.5[-_]?sonnet\b/i,
  /\b4\.5[-_]?sonnet\b/i,
];

function isSonnet5(text: string): boolean {
  for (const exclude of EXCLUDE_PATTERNS) {
    if (exclude.test(text)) {
      return false;
    }
  }
  for (const pattern of SONNET_5_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

async function checkAnthropicModels(): Promise<{
  found: boolean;
  model: string | null;
}> {
  if (!ANTHROPIC_API_KEY) {
    console.log("No ANTHROPIC_API_KEY set, skipping API check");
    return { found: false, model: null };
  }

  try {
    const headers: Record<string, string> = {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };

    if (lastEtag) {
      headers["If-None-Match"] = lastEtag;
    }

    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers,
    });

    if (response.status === 304) {
      console.log("Models unchanged (304)");
      return { found: lastStatus.found, model: lastStatus.model };
    }

    const etag = response.headers.get("etag");
    if (etag) lastEtag = etag;

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { id?: string; display_name?: string }[];
    };
    const models = data.data || [];

    for (const model of models) {
      const modelId = model.id || "";
      const displayName = model.display_name || "";

      if (isSonnet5(modelId)) {
        return { found: true, model: modelId };
      }
      if (isSonnet5(displayName)) {
        return { found: true, model: modelId };
      }
    }

    return { found: false, model: null };
  } catch (error) {
    console.error("Error checking Anthropic models:", error);
    return { found: false, model: null };
  }
}

async function scrapeAnthropicPages(): Promise<{
  found: boolean;
  source: string | null;
}> {
  const urls = [
    "https://www.anthropic.com/news",
    "https://docs.anthropic.com/en/release-notes/overview",
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Sonnet5Checker/1.0; +https://github.com)",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();

      const lines = html.split(/[<>]/);
      for (const line of lines) {
        const cleaned = line.replace(/&[^;]+;/g, " ").trim();
        if (cleaned.length < 200 && isSonnet5(cleaned)) {
          return { found: true, source: url };
        }
      }
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
    }
  }

  return { found: false, source: null };
}

async function performCheck(): Promise<void> {
  if (isChecking) return;
  isChecking = true;

  console.log(`[${new Date().toISOString()}] Checking for Sonnet 5...`);

  try {
    const [apiResult, scrapeResult] = await Promise.all([
      checkAnthropicModels(),
      scrapeAnthropicPages(),
    ]);

    const found = apiResult.found || scrapeResult.found;
    const model = apiResult.model;
    const source = scrapeResult.found ? scrapeResult.source : null;

    lastStatus = {
      found,
      model,
      source,
      checkedAt: new Date().toISOString(),
    };

    console.log(
      `[${lastStatus.checkedAt}] Check complete: found=${found}, model=${model}, source=${source}`
    );

    if (found && !previouslyFound) {
      previouslyFound = true;
      await notifySonnet5Dropped(model, source);
    }
  } catch (error) {
    console.error("Check failed:", error);
  } finally {
    isChecking = false;
  }
}

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  })
);

app.get("/", (c) => {
  return c.json({ service: "sonnet5-checker", status: "running" });
});

app.get("/status", (c) => {
  return c.json(lastStatus);
});

app.get("/health", (c) => {
  return c.json({ ok: true });
});

app.post("/check", async (c) => {
  await performCheck();
  return c.json(lastStatus);
});

app.get("/push/vapid-public-key", (c) => {
  const key = getVapidPublicKey();
  if (!key) {
    return c.json({ error: "Web Push not configured" }, 503);
  }
  return c.json({ publicKey: key });
});

app.post("/push/subscribe", async (c) => {
  try {
    const subscription = (await c.req.json()) as PushSubscription;

    if (!subscription.endpoint || !subscription.keys) {
      return c.json({ error: "Invalid subscription" }, 400);
    }

    await saveSubscription(subscription);
    return c.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return c.json({ error: "Failed to save subscription" }, 500);
  }
});

app.delete("/push/subscribe", async (c) => {
  try {
    const { endpoint } = (await c.req.json()) as { endpoint: string };

    if (!endpoint) {
      return c.json({ error: "Missing endpoint" }, 400);
    }

    await removeSubscription(endpoint);
    return c.json({ success: true });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return c.json({ error: "Failed to remove subscription" }, 500);
  }
});

app.get("/ntfy/topic", (c) => {
  const topic = process.env.NTFY_TOPIC || "did-sonnet5-drop";
  return c.json({ topic, url: `https://ntfy.sh/${topic}` });
});

initWebPush();
performCheck();
setInterval(performCheck, 60 * 1000);

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});
