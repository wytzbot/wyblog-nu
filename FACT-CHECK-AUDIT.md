# WyBlog integration fact-check audit

- Blogger draft creation uses `posts.insert?isDraft=true`; published updates use the Blogger update `publish=true` parameter.
- Flutterwave v4 uses OAuth client credentials, v4 production base URL, payment-method creation, charge creation, charge retrieval, idempotency and redirect/authorization handling.
- The billing config endpoint is authenticated; the Flutterwave encryption key is not exposed to unauthenticated callers.
- WyBlog stores `userId`, customer ID, payment method ID, amount, currency and reference for webhook/cron verification.
- Flutterwave webhook ownership is delegated to WyteLab. `WYBLOG-*` transactions are routed to the WyBlog Firebase project by the shared WyteLab webhook.
- FCM uses the supplied Firebase Web App config and a separately generated Web Push VAPID public key. HTTPS and the messaging service worker are required.
- Daily diagnosis is cached once per UTC day; Pro does not consume an extra paid-only diagnosis quota.
- SEO suggestions are Pro-only and throttled to one batch every three days; each batch stores up to five ideas and posts an in-app notification plus push notification.
- Plugin article integration uses a per-plugin HTML marker to prevent duplicate insertion into the same draft. Theme/server/editor plugins are deliberately not falsely injected into article HTML.
- The editor has a real Blogger publish-success confirmation and guards duplicate publish/save clicks while a request is active.

## Remaining external prerequisites

1. Fill the Firebase Web Push VAPID public key in `src/firebase-config.json`.
2. Enable Firebase Anonymous Authentication and Firestore for the WyBlog Firebase project.
3. Add WyBlog Firebase Admin credentials to the shared WyteLab webhook as `WYBLOG_FIREBASE_SERVICE_ACCOUNT_JSON` OR the three `WYBLOG_FIREBASE_*` variables.
4. Configure the Flutterwave merchant webhook URL to `https://YOUR_WYTELAB_DOMAIN/api/billing/webhook` and set the same `FLW_WEBHOOK_SECRET_HASH` in WyteLab.
5. Complete Flutterwave live KYC/permissions and test v4 sandbox before production.
6. Complete Google OAuth/Blogger API configuration.
7. Add `GEMINI_API_KEY` to WyBlog Vercel.
