# Web Push Demo

This example separates the page markup (`test.html`), styles (`styles.css`), and
browser interaction (`client.js`). The `sw.js` service worker displays received
notifications, while `server.js` stores subscriptions and sends broadcasts.
`manifest.json` and the 192x192 / 512x512 PNG icons provide the installable PWA
metadata and app icons.
Push notifications require a secure context: use `http://localhost` for local
testing, or HTTPS when hosting the site.

## Run locally

1. Install the dependencies:

   ```powershell
   npm install
   ```

2. Generate VAPID keys:

   ```powershell
   npm run generate-vapid
   ```

   Copy the printed public and private keys into the environment variables below.
   Keep the private key secret.

3. Set the values in PowerShell and start the server:

   ```powershell
   $env:VAPID_PUBLIC_KEY = "your-generated-public-key"
   $env:VAPID_PRIVATE_KEY = "your-generated-private-key"
   npm start
   ```

4. Open `http://localhost:3000`, subscribe each browser that should receive
   notifications, then enter a message to broadcast.

On Android, open the deployed HTTPS site in Chrome and choose **Install app**
from the browser menu. This installs the website as a PWA; it does not create an
APK or publish the app to the Play Store. After changing the manifest or icons,
redeploy the server and reload the site before trying to install again.

Subscriptions are stored in `subscriptions.json` and removed automatically when
the push service reports that they have expired. The send endpoint has no
authentication, so anyone who can reach the server can send messages to all
subscribers. Keep this demo on localhost or add server-side authentication
before deploying it publicly.
