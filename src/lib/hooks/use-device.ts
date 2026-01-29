"use client";

import { useEffect } from "react";
import {
  browserName,
  browserVersion,
  isDesktop,
  isMobile,
  isTablet,
  mobileModel,
  mobileVendor,
  osName,
  osVersion,
} from "react-device-detect";
import { useMediaQuery } from "react-responsive";
import { create } from "zustand";

export interface DeviceMetadata {
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  mobileVendor: string | null;
  mobileModel: string | null;
}

export interface DeviceInfo {
  // Device form factor
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Input capability
  isTouch: boolean;

  // Screen size breakpoints (Tailwind-like)
  isSm: boolean; // >= 640px
  isMd: boolean; // >= 768px
  isLg: boolean; // >= 1024px
  isXl: boolean; // >= 1280px
  is2Xl: boolean; // >= 1536px

  // Orientation
  isPortrait: boolean;

  // Optional metadata for debugging/analytics
  metadata: DeviceMetadata;
}

interface DeviceStore extends DeviceInfo {
  isMounted: boolean;
  setMounted: (mounted: boolean) => void;
  updateBreakpoint: (key: keyof DeviceInfo, value: boolean) => void;
  updateMetadata: (metadata: DeviceMetadata) => void;
}

// SSR-safe default values
const DEFAULT_DEVICE_INFO: DeviceInfo = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  isSm: true,
  isMd: true,
  isLg: true,
  isXl: true,
  is2Xl: true,
  isPortrait: false,
  metadata: {
    os: null,
    osVersion: null,
    browser: null,
    browserVersion: null,
    mobileVendor: null,
    mobileModel: null,
  },
};

/**
 * Zustand store for device information
 * Enables selective subscriptions to prevent unnecessary re-renders
 */
const useDeviceStore = create<DeviceStore>((set) => ({
  ...DEFAULT_DEVICE_INFO,
  isMounted: false,
  setMounted: (mounted) => set({ isMounted: mounted }),
  updateBreakpoint: (key, value) => set({ [key]: value }),
  updateMetadata: (metadata) => set({ metadata }),
}));

/**
 * Internal hook that syncs device state with the Zustand store
 * This component should be mounted once at the app level
 */
function useDeviceSync() {
  const setMounted = useDeviceStore((state) => state.setMounted);
  const updateBreakpoint = useDeviceStore((state) => state.updateBreakpoint);
  const updateMetadata = useDeviceStore((state) => state.updateMetadata);

  // Media queries for responsive breakpoints
  const isSm = useMediaQuery({ minWidth: 640 });
  const isMd = useMediaQuery({ minWidth: 768 });
  const isLg = useMediaQuery({ minWidth: 1024 });
  const isXl = useMediaQuery({ minWidth: 1280 });
  const is2Xl = useMediaQuery({ minWidth: 1536 });
  const isPortrait = useMediaQuery({ orientation: "portrait" });
  const isTouch = useMediaQuery({ query: "(pointer: coarse)" });

  // Mount effect
  useEffect(() => {
    setMounted(true);

    // Update static device metadata once on mount
    updateMetadata({
      os: osName || null,
      osVersion: osVersion || null,
      browser: browserName || null,
      browserVersion: browserVersion || null,
      mobileVendor: mobileVendor || null,
      mobileModel: mobileModel || null,
    });

    // Update device form factors
    updateBreakpoint("isMobile", isMobile);
    updateBreakpoint("isTablet", isTablet);
    updateBreakpoint("isDesktop", isDesktop);
  }, [setMounted, updateMetadata, updateBreakpoint]);

  // Sync responsive breakpoints
  useEffect(() => {
    updateBreakpoint("isSm", isSm);
  }, [isSm, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("isMd", isMd);
  }, [isMd, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("isLg", isLg);
  }, [isLg, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("isXl", isXl);
  }, [isXl, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("is2Xl", is2Xl);
  }, [is2Xl, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("isPortrait", isPortrait);
  }, [isPortrait, updateBreakpoint]);

  useEffect(() => {
    updateBreakpoint("isTouch", isTouch);
  }, [isTouch, updateBreakpoint]);
}

/**
 * Component to sync device state - mount once in app layout
 * This ensures the device store stays up-to-date with media queries
 */
export function DeviceSync() {
  useDeviceSync();
  return null;
}

/**
 * Comprehensive device detection hook with selective subscriptions (Zustand-like)
 *
 * Usage examples:
 *
 * // Subscribe to all device info (re-renders on any change)
 * const device = useDevice();
 *
 * // Subscribe to specific property (re-renders only when isSm changes)
 * const isSm = useDevice((state) => state.isSm);
 *
 * // Subscribe to multiple specific properties
 * const { isMobile, isTouch } = useDevice((state) => ({
 *   isMobile: state.isMobile,
 *   isTouch: state.isTouch
 * }));
 *
 * @param selector - Optional selector function for granular subscriptions
 * @returns DeviceInfo object or selected value(s)
 */
export function useDevice(): DeviceInfo;
export function useDevice<T>(selector: (state: DeviceInfo) => T): T;
export function useDevice<T>(
  selector?: (state: DeviceInfo) => T,
): DeviceInfo | T {
  if (selector) {
    return useDeviceStore(selector);
  }

  // Return all device info (excluding store methods)
  return useDeviceStore((state) => ({
    isMobile: state.isMobile,
    isTablet: state.isTablet,
    isDesktop: state.isDesktop,
    isTouch: state.isTouch,
    isSm: state.isSm,
    isMd: state.isMd,
    isLg: state.isLg,
    isXl: state.isXl,
    is2Xl: state.is2Xl,
    isPortrait: state.isPortrait,
    metadata: state.metadata,
  }));
}
