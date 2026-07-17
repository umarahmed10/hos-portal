"use client";
import { useEffect, useState } from "react";

export type PushState = "idle" | "subscribed" | "denied" | "unsupported";

interface IncomingCall {
  caller: string;
  expiresAt: number;
}

interface Options {
  code: string;
  vapidPublicKey: string;
  ready: boolean;
  onIncoming: (call: IncomingCall) => void;
  onJoinCall: () => void;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePushSubscription({ code, vapidPublicKey, ready, onIncoming, onJoinCall }: Options): PushState {
  const [pushState, setPushState] = useState<PushState>("idle");

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }

    let cancelled = false;

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === "join-call" && msg.room === code) {
        onJoinCall();
        return;
      }
      if (msg.type === "incoming-call" && msg.code === code) {
        onIncoming({
          caller: msg.callerName || "HOS Team",
          expiresAt: msg.expiresAt || (Date.now() + 25_000),
        });
      }
    };

    (async () => {
      await navigator.serviceWorker.register("/sw-comms.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      navigator.serviceWorker.addEventListener("message", onMessage);

      let perm: NotificationPermission = Notification.permission;
      if (perm === "default") perm = await Notification.requestPermission();
      if (perm !== "granted") {
        if (!cancelled) setPushState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      await fetch("/api/comms/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, asRole: "client", subscription: sub.toJSON() }),
      });

      if (!cancelled) setPushState("subscribed");
    })().catch(e => {
      console.error("[comms] push setup failed", e);
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [ready, code, vapidPublicKey, onIncoming, onJoinCall]);

  return pushState;
}
