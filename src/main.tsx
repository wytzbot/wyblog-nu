import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeWyBlogAnalytics } from "./firebase";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);

// Analytics is optional and initialized safely without blocking the app.
void initializeWyBlogAnalytics();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {
      // Push is optional; app functionality must continue if SW registration fails.
    });
  });
}