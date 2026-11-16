const statusElement = document.querySelector("#status");

function setStatus(message) {
  statusElement.textContent = message;
}

// VAPID public keys use URL-safe Base64; PushManager expects the decoded bytes.
function decodeVapidKey(key) {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

document.querySelector("#subscribe").addEventListener("click", async () => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support push notifications.");
    }

    /*
    // Permission requires a browser prompt initiated by the user's button click.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }
    */

    // The service worker receives pushes when this page is closed or in the background.
    const registration = await navigator.serviceWorker.register("/sw.js");
    const response = await fetch("/api/vapid-public-key");
    if (!response.ok) {
      throw new Error("Could not load the push server's public key.");
    }

    const { publicKey } = await response.json();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
    }

    // Save this browser's push-service address on the server for later broadcasts.
    const saveResponse = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    const result = await saveResponse.json();
    if (!saveResponse.ok) {
      throw new Error(result.error || "Could not save this subscription.");
    }

    setStatus("This browser is subscribed.");
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector("#send-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#message").value.trim();

  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "The message could not be sent.");
    }

    setStatus(`Push sent to ${result.sent}  r(s).`);
  } catch (error) {
    setStatus(error.message);
  }
});
