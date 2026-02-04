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
import { checkAllSources, type CheckResult } from "./sources.js";

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

let isChecking = false;
let previouslyFound = false;

const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

async function performCheck(): Promise<void> {
  if (isChecking) return;
  isChecking = true;

  try {
    const result: CheckResult = await checkAllSources();

    lastStatus = {
      found: result.found,
      model: result.model,
      source: result.source,
      checkedAt: new Date().toISOString(),
    };

    if (result.found && !previouslyFound) {
      previouslyFound = true;
      await notifySonnet5Dropped(result.model, result.source);
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
  return c.json({
    service: "sonnet5-checker",
    status: "running",
    checkInterval: `${CHECK_INTERVAL_MS / 1000}s`,
    sources: ["Anthropic API", "Anthropic Website", "Hacker News", "GitHub SDK"],
  });
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

app.post("/trigger", async (c) => {
  const authHeader = c.req.header("Authorization");
  const expectedToken = process.env.SCHEDULER_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await performCheck();
  return c.json({ triggered: true, status: lastStatus });
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
setInterval(performCheck, CHECK_INTERVAL_MS);

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`Starting server on port ${port}...`);
console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
console.log(`Sources: Anthropic API, Website, Hacker News, GitHub SDK`);

serve({
  fetch: app.fetch,
  port,
});
