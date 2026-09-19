# WyBlog

WyBlog is a mobile-first Blogger workspace. Blogger remains the publishing backend.

## Important configuration split

### Firebase Web SDK — public client configuration, NOT env vars
Edit `src/firebase-config.json` and replace every `REPLACE_WITH_...` value:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId` (optional)
- `vapidKey` (Firebase Web Push certificate key)

The Vite build copies these public values into the Firebase messaging service worker. Do not put Firebase Admin credentials here.

### Firebase Admin — server-only
Set these in Vercel:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Blogger OAuth — server-only
- `APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `BLOGGER_TOKEN_ENCRYPTION_KEY`

### Gemini AI — server-only
- `GEMINI_API_KEY`
- `GEMINI_SUGGESTION_MODEL` defaults to `gemini-2.5-flash-lite`
- `GEMINI_DIAGNOSIS_MODEL` defaults to `gemini-2.5-flash`
- `GEMINI_FALLBACK_MODEL` defaults to `gemini-2.5-flash-lite`

Pro SEO suggestions are generated every 3 days when due and contain exactly five focused, low-competition candidates. The app does not invent search-volume numbers or guarantee ranking. Suggested posting times are reported in Africa/Lagos.

Daily diagnosis is cached once per UTC day per connected user. Pro does not consume a monthly diagnosis bucket; Pro users receive the same daily diagnosis capability.

### Flutterwave v4 — server-only
WyBlog uses the Flutterwave v4 OAuth/charges/payment-method flow:

- `FLW_ENV`
- `FLW_BASE_URL`
- `FLW_CLIENT_ID`
- `FLW_CLIENT_SECRET`
- `FLW_ENCRYPTION_KEY`
- `FLW_PRO_USD=1`
- `FLW_PRO_NGN=1000`

WyBlog does **not** expose a Flutterwave webhook route because the merchant webhook is already occupied by WyteLab. Initial payments are verified by the v4 charge retrieval flow and renewals are checked by a Vercel cron job using the stored Flutterwave customer/payment-method IDs.

Direct card collection requires the merchant to satisfy Flutterwave's requirements for that feature. Test in Flutterwave sandbox before production.

## Getting Firebase values

1. Open Firebase Console.
2. Select the Firebase project used by WyBlog.
3. Open **Project settings → General**.
4. Under **Your apps**, register/select a **Web app**.
5. Copy the web configuration into `src/firebase-config.json`.
6. Open **Project settings → Cloud Messaging**.
7. Under **Web configuration / Web Push certificates**, generate or copy the Web Push certificate key and place it in `vapidKey`.
8. In **Authentication → Sign-in method**, enable **Anonymous** because WyBlog uses a Firebase user ID to protect drafts, notifications and device tokens.
9. In **Firestore Database**, create the database and deploy `firestore.rules`.
10. Rebuild. No `VITE_FIREBASE_*` variables are required. The supplied Firebase Web SDK config is stored in `src/firebase-config.json`; only the Web Push VAPID public key remains to be filled from Firebase Console.

## Google Blogger setup

1. Open Google Cloud Console.
2. Create/select the project used for WyBlog.
3. Enable **Blogger API v3**.
4. Configure the OAuth consent screen.
5. Create a Web OAuth client.
6. Add the exact redirect URI: `https://YOUR-DOMAIN/api/auth/callback`.
7. Put the client ID/secret in Vercel server variables.
8. Connect Blogger from WyBlog and authorize the Google account that owns the blog.

WyBlog stores the Blogger refresh token encrypted server-side.

## Flutterwave v4 setup

1. Open Flutterwave Developer Dashboard and switch to the intended v4 environment.
2. Get the v4 Client ID and Client Secret.
3. Get the Flutterwave encryption key required for encrypted card payment-method data.
4. Configure the amounts as `$1` and `₦1,000`.
5. Test with Flutterwave sandbox first.
6. Verify that the connected Blogger email is the email used in the checkout; WyBlog rejects a different email.
7. The checkout requires a full name matching the cardholder name.
8. Expiry automatically formats as `MM/YY`; CVV is never stored by WyBlog.

## AI models and fallback

`gemini-2.5-flash-lite` is used first for the high-volume 3-day topic suggestions because Google documents it as a small, cost-effective model. `gemini-2.5-flash` handles the daily site diagnosis. If the selected model fails, the configured fallback model is attempted.

## Notifications

FCM tokens are stored per Firebase user with a SHA-256 document ID. SEO suggestion notifications are written to the in-app notification feed and pushed immediately to registered devices. The notification service worker handles background clicks back into WyBlog's Alerts page.

## Serverless limit

There is one serverless function: `api/index.js`. Vercel routes all `/api/*` requests to it. Scheduled jobs also enter that same function.
