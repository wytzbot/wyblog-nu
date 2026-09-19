import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export default defineConfig({ plugins: [react(), { name: "wyblog-firebase-sw-config", apply: "build", closeBundle(){ const c=JSON.parse(readFileSync(resolve(process.cwd(),"src/firebase-config.json"),"utf8")); writeFileSync(resolve(process.cwd(),"dist/firebase-config.js"),`self.WYBLOG_FIREBASE_CONFIG=${JSON.stringify({apiKey:c.apiKey,authDomain:c.authDomain,projectId:c.projectId,storageBucket:c.storageBucket,messagingSenderId:c.messagingSenderId,appId:c.appId,measurementId:c.measurementId||undefined})};self.WYBLOG_FIREBASE_VAPID_KEY=${JSON.stringify(c.vapidKey||"")};`); } }] });
