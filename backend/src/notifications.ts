import webpush from "web-push";
import { Firestore } from "@google-cloud/firestore";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "did-sonnet5-drop";

let firestore: Firestore | null = null;
let notificationSent = false;

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function getFirestore(): Firestore {
  if (!firestore) {
    firestore = new Firestore();
  }
  return firestore;
}

export function initWebPush(): boolean {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("VAPID keys not configured, Web Push disabled");
    return false;
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("Web Push initialized");
  return true;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function saveSubscription(
  subscription: PushSubscription
): Promise<void> {
  const db = getFirestore();
  const docId = Buffer.from(subscription.endpoint).toString("base64url");

  await db.collection("push-subscriptions").doc(docId).set({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    createdAt: new Date().toISOString(),
  });

  console.log("Saved push subscription");
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = getFirestore();
  const docId = Buffer.from(endpoint).toString("base64url");

  await db.collection("push-subscriptions").doc(docId).delete();
  console.log("Removed push subscription");
}

async function getAllSubscriptions(): Promise<PushSubscription[]> {
  const db = getFirestore();
  const snapshot = await db.collection("push-subscriptions").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      endpoint: data.endpoint,
      keys: data.keys,
    };
  });
}

async function sendWebPushNotifications(
  model: string | null,
  source: string | null
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await getAllSubscriptions();
  console.log(`Sending Web Push to ${subscriptions.length} subscribers`);

  const payload = JSON.stringify({
    title: "Sonnet 5 has dropped!",
    body: model ? `Model: ${model}` : "Claude Sonnet 5 is now available!",
    url: source || "https://anthropic.com",
    icon: "/favicon.svg",
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (error: unknown) {
        const err = error as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          await removeSubscription(sub.endpoint);
        }
        throw error;
      }
    })
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`Web Push sent: ${successful} succeeded, ${failed} failed`);
}

async function sendNtfyNotification(
  model: string | null,
  source: string | null
): Promise<void> {
  const title = "Sonnet 5 has dropped!";
  const body = model
    ? `Model: ${model}`
    : "Claude Sonnet 5 is now available!";

  try {
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "urgent",
        Tags: "tada,robot",
        Click: source || "https://anthropic.com",
      },
      body: body,
    });

    if (response.ok) {
      console.log(`ntfy.sh notification sent to topic: ${NTFY_TOPIC}`);
    } else {
      console.error(`ntfy.sh failed: ${response.status}`);
    }
  } catch (error) {
    console.error("ntfy.sh error:", error);
  }
}

export async function notifySonnet5Dropped(
  model: string | null,
  source: string | null
): Promise<void> {
  if (notificationSent) {
    console.log("Notification already sent, skipping");
    return;
  }

  notificationSent = true;
  console.log("Sonnet 5 detected! Sending notifications...");

  await Promise.allSettled([
    sendWebPushNotifications(model, source),
    sendNtfyNotification(model, source),
  ]);
}

export function resetNotificationSent(): void {
  notificationSent = false;
}
