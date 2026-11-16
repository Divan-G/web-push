const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const webpush = require("web-push");

const requiredEnvironment = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const app = express();
const port = Number(process.env.PORT) || 3000;
const subscriptionsPath = path.join(__dirname, "subscriptions.json");

if (!fs.existsSync(subscriptionsPath)) {
  fs.writeFileSync(subscriptionsPath, "[]\n", { flag: "wx" });
}

app.use(express.json({ limit: "16kb" }));

function readSubscriptions() {
  return JSON.parse(fs.readFileSync(subscriptionsPath, "utf8"));
}

function writeSubscriptions(subscriptions) {
  fs.writeFileSync(subscriptionsPath, `${JSON.stringify(subscriptions, null, 2)}\n`);
}

function isValidSubscription(subscription) {
  return (
    subscription &&
    typeof subscription.endpoint === "string" &&
    typeof subscription.keys?.p256dh === "string" &&
    typeof subscription.keys?.auth === "string"
  );
}

app.get("/", (_request, response) => {
  response.sendFile(path.join(__dirname, "test.html"));
});

app.get("/styles.css", (_request, response) => {
  response.type("text/css").sendFile(path.join(__dirname, "styles.css"));
});

app.get("/client.js", (_request, response) => {
  response.type("application/javascript").sendFile(path.join(__dirname, "client.js"));
});

app.get("/manifest.json", (_request, response) => {
  response.type("application/manifest+json").sendFile(path.join(__dirname, "manifest.json"));
});

app.get("/icon-192.png", (_request, response) => {
  response.type("image/png").sendFile(path.join(__dirname, "icon-192.png"));
});

app.get("/icon-512.png", (_request, response) => {
  response.type("image/png").sendFile(path.join(__dirname, "icon-512.png"));
});

app.get("/sw.js", (_request, response) => {
  response.type("application/javascript").sendFile(path.join(__dirname, "sw.js"));
});

app.get("/api/vapid-public-key", (_request, response) => {
  response.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post("/api/subscribe", (request, response) => {
  const subscription = request.body;
  if (!isValidSubscription(subscription)) {
    return response.status(400).json({ error: "Invalid push subscription." });
  }

  const subscriptions = readSubscriptions();
  const existingIndex = subscriptions.findIndex(
    (item) => item.endpoint === subscription.endpoint,
  );
  if (existingIndex === -1) {
    subscriptions.push(subscription);
  } else {
    subscriptions[existingIndex] = subscription;
  }

  writeSubscriptions(subscriptions);
  return response.status(201).json({ ok: true });
});

app.post("/api/send", async (request, response) => {
  const message = typeof request.body?.message === "string"
    ? request.body.message.trim()
    : "";
  if (!message || message.length > 2000) {
    return response.status(400).json({ error: "Message must be between 1 and 2000 characters." });
  }

  const subscriptions = readSubscriptions();
  if (subscriptions.length === 0) {
    return response.status(400).json({ error: "There are no subscribers yet." });
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify({ title: "Message from this site", body: message }),
      ),
    ),
  );

  const activeSubscriptions = subscriptions.filter((_subscription, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      return true;
    }

    const statusCode = result.reason?.statusCode;
    return statusCode !== 404 && statusCode !== 410;
  });
  if (activeSubscriptions.length !== subscriptions.length) {
    writeSubscriptions(activeSubscriptions);
  }

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (sent === 0) {
    return response.status(502).json({ error: "Push delivery failed for all subscribers." });
  }

  return response.json({ sent, failed });
});

app.listen(port, () => {
  console.log(`Web Push demo is running at http://localhost:${port}`);
});
