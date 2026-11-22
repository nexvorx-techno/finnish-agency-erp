"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Download, RefreshCw, X, MonitorSmartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const PwaManager: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showManualHint, setShowManualHint] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Detect standalone installed mode & listen for install prompt
  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowManualHint(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

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

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowManualHint((v) => !v);
    }
  }, [deferredPrompt]);

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

      {/* 2. ADD TO DESKTOP / INSTALL APP BUTTON (Shown on Web App until installed) */}
      {!isInstalled && (
        <div className="fixed bottom-4 left-4 z-[85] flex flex-col items-start gap-2">
          {showManualHint && (
            <div className="w-72 p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <MonitorSmartphone className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Add to Desktop / Home Screen</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualHint(false)}
                  className="text-[var(--text-secondary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                <strong>Desktop (Chrome/Edge):</strong> Click the install icon in the address bar or Menu → <em>Save and Share → Install App</em>.<br />
                <strong>iPhone / iPad:</strong> Tap <em>Share → Add to Home Screen</em>.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-primary)] text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            title="Install Client Portal as a Desktop / Mobile App"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent-color)] group-hover:text-white" />
            <span>Add to Desktop</span>
          </button>
        </div>
      )}
    </>
  );
};
