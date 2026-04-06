"use client";

import { useEffect, useRef, useState } from "react";

type JscanifyClass = typeof import("jscanify/client").default;
export type JscanifyInstance = InstanceType<JscanifyClass>;

/** Singleton promise so opencv.js is loaded only once per page, even when
 *  multiple components (scan-tester + camera-capture) mount concurrently. */
let opencvLoadPromise: Promise<void> | null = null;

function loadOpenCv(): Promise<void> {
  if (opencvLoadPromise) return opencvLoadPromise;

  opencvLoadPromise = new Promise<void>((resolve) => {
    const win = window as typeof window & { cv?: { Mat?: unknown } };

    // Already loaded — resolve immediately.
    if (win.cv?.Mat) {
      resolve();
      return;
    }

    // Poll if a <script> for opencv.js is already in the document (loading).
    const existing = document.querySelector('script[src="/opencv.js"]');
    if (existing) {
      const check = setInterval(() => {
        if ((window as typeof window & { cv?: { Mat?: unknown } }).cv?.Mat) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      return;
    }

    // Inject the script and poll until cv.Mat is available.
    const script = document.createElement("script");
    script.src = "/opencv.js";
    script.async = true;
    document.head.appendChild(script);
    script.onload = () => {
      const wait = setInterval(() => {
        if ((window as typeof window & { cv?: { Mat?: unknown } }).cv?.Mat) {
          clearInterval(wait);
          resolve();
        }
      }, 50);
    };
    script.onerror = () => {
      // Reset so the next caller can try again.
      opencvLoadPromise = null;
      resolve(); // resolve anyway so callers don't hang
    };
  });

  return opencvLoadPromise;
}

/**
 * Asynchronously loads opencv.js and initialises a jscanify instance.
 *
 * opencv.js is loaded only once per page (module-level singleton), so every
 * component that calls this hook shares the same ready state after the first
 * load completes.
 */
export function useJscanify() {
  const scannerRef = useRef<JscanifyInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await loadOpenCv();
        if (!mounted) return;
        const { default: JscanifyClass } = await import("jscanify/client");
        if (!mounted) return;
        scannerRef.current = new JscanifyClass();
        setReady(true);
      } catch (e) {
        console.error("jscanify init failed:", e);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  return { scanner: scannerRef, ready };
}
