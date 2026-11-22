"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";

export const PwaManager: React.FC = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Register Service Worker & detect new app updates automatically
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateInterval: ReturnType<typeof setInterval> | null = null;
    let regRef: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        regRef = registration;

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            }
          });
        });

        // Poll for updates every 60s & when user switches back to the app
        updateInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, 60000);
      })
      .catch(() => {});

    const onVisibility = () => {
      if (document.visibilityState === "visible" && regRef) {
        regRef.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibility);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  const handleApplyUpdate = useCallback(() => {
    setIsUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }, [waitingWorker]);

  return (
    <>
      {/* 1. PWA NEW UPDATE NOTIFICATION */}
      {updateAvailable && (
        <div className="fixed top-4 right-4 z-[120] max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--accent-color)] shadow-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-light)] text-[var(--accent-color)] flex items-center justify-center shrink-0">
            <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[var(--text-primary)]">
              New Application Update Available
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
              A newer version of Finnish Agency ERP is ready. Update now to load the latest changes.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleApplyUpdate}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-bold cursor-pointer disabled:opacity-60"
              >
                {isUpdating ? "Updating..." : "Update Now"}
              </button>
              <button
                type="button"
                onClick={() => setUpdateAvailable(false)}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpdateAvailable(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
