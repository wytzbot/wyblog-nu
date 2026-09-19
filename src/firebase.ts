import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getMessaging, getToken, isSupported as messagingSupported, type Messaging } from "firebase/messaging";
import config from "./firebase-config.json";

// Firebase Web SDK values are public client configuration. They intentionally live in source, not Vercel env vars.
// Replace only the values below with the Web App config and Web Push certificate key from the Firebase Console.
export const firebaseConfig = { apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, storageBucket: config.storageBucket, messagingSenderId: config.messagingSenderId, appId: config.appId, measurementId: config.measurementId || undefined };
export const WYBLOG_FIREBASE_VAPID_KEY = config.vapidKey;

const configured = Object.values(firebaseConfig).every(v => v && !String(v).startsWith("REPLACE_WITH")) && !WYBLOG_FIREBASE_VAPID_KEY.startsWith("REPLACE_WITH");
if (!configured) console.warn("WyBlog Firebase is not configured. Add the public Firebase Web App config and Web Push certificate key in src/firebase.ts.");

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export async function initializeWyBlogAnalytics() {
  if (typeof window === "undefined" || !configured) return null;
  try { if (!(await analyticsSupported())) return null; return getAnalytics(firebaseApp); } catch { return null; }
}
export async function getWyBlogMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined" || !configured || !("serviceWorker" in navigator)) return null;
  try { if (!(await messagingSupported())) return null; return getMessaging(firebaseApp); } catch { return null; }
}
export async function enableWyBlogNotifications(): Promise<{ token: string | null; reason?: string }> {
  if (typeof window === "undefined") return { token: null, reason: "browser-only" };
  if (!configured) return { token: null, reason: "firebase-config-not-configured" };
  if (!("Notification" in window)) return { token: null, reason: "notifications-unsupported" };
  if (!window.isSecureContext) return { token: null, reason: "https-required" };
  if (!("serviceWorker" in navigator)) return { token: null, reason: "service-worker-unsupported" };
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return { token: null, reason: `permission-${permission}` };
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    const messaging = await getWyBlogMessaging();
    if (!messaging) return { token: null, reason: "messaging-unsupported" };
    const token = await getToken(messaging, { vapidKey: WYBLOG_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return { token: null, reason: "token-unavailable" };
    localStorage.setItem("wyblog_fcm_token", token);
    return { token };
  } catch (e) { return { token: null, reason: e instanceof Error ? e.message : "fcm-registration-failed" }; }
}
