"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type PermState = "default" | "granted" | "denied" | "unsupported";
type Mode = "icon" | "full"; // icon = header bell, full = sidebar row

interface PushManagerProps {
  mode?: Mode;
}

export function PushManager({ mode = "full" }: PushManagerProps) {
  const [perm, setPerm] = useState<PermState>("default");
  const [loading, setLoading] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [subbed, setSubbed] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    // Web Push requires HTTPS (or localhost)
    const secure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    setIsSecure(secure);

    if (!secure) return; // Don't bother registering SW on HTTP

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPerm("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        setSwReady(true);
        setPerm(Notification.permission as PermState);
        const existing = await reg.pushManager.getSubscription();
        setSubbed(!!existing);
      })
      .catch((err) => console.error("SW registration failed:", err));
  }, []);

  const subscribe = async () => {
    if (!swReady) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      setPerm(permission as PermState);
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ).buffer as ArrayBuffer,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setSubbed(true);
    } catch (err) {
      console.error("Subscribe error:", err);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!swReady) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubbed(false);
    } catch (err) {
      console.error("Unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── HTTP warning (non-secure origin) ───────────────────
  if (!isSecure) {
    if (mode === "icon") {
      return (
        <div className="relative">
          <button
            onClick={() => setShowTip(!showTip)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Notifications require HTTPS"
          >
            <BellOff className="w-5 h-5 text-amber-500" />
          </button>
          {showTip && (
            <div className="absolute right-0 top-11 z-50 w-72 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 shadow-xl text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Notifications require HTTPS
              </p>
              <p>Your app is running over HTTP (<code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{typeof window !== "undefined" ? window.location.host : ""}</code>). To enable notifications:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Open <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">chrome://flags</code></li>
                <li>Search <strong>"Insecure origins treated as secure"</strong></li>
                <li>Add <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded break-all">{typeof window !== "undefined" ? window.location.origin : ""}</code></li>
                <li>Set to <strong>Enabled</strong> → Relaunch</li>
                <li>Come back here and enable notifications</li>
              </ol>
            </div>
          )}
        </div>
      );
    }
    return null; // Don't show full button in sidebar on HTTP
  }

  if (perm === "unsupported") return null;

  const handleClick = () => (subbed ? unsubscribe() : subscribe());

  // ─── Icon-only mode (Header) ─────────────────────────────
  if (mode === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={loading || perm === "denied"}
        title={
          perm === "denied"
            ? "Notifications blocked — check browser settings"
            : subbed
            ? "Notifications On — click to disable"
            : "Enable Notifications"
        }
        className={cn(
          "p-2 rounded-xl transition-colors relative",
          subbed
            ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            : perm === "denied"
            ? "text-red-400 opacity-60"
            : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        )}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : subbed ? (
          <>
            <BellRing className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
          </>
        ) : perm === "denied" ? (
          <BellOff className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </button>
    );
  }

  // ─── Full mode (Sidebar) ─────────────────────────────────
  return (
    <button
      onClick={handleClick}
      disabled={loading || perm === "denied"}
      title={perm === "denied" ? "Notifications blocked — check browser settings" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
        subbed
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
          : perm === "denied"
          ? "text-red-400 bg-red-500/10 border border-red-500/20 cursor-not-allowed opacity-70"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
      )}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
      ) : subbed ? (
        <BellRing className="w-5 h-5 flex-shrink-0" />
      ) : perm === "denied" ? (
        <BellOff className="w-5 h-5 flex-shrink-0" />
      ) : (
        <Bell className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="truncate">
        {loading ? "Please wait..." : subbed ? "Notifications On" : perm === "denied" ? "Notifications Blocked" : "Enable Notifications"}
      </span>
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
