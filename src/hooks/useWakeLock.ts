'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true); // User toggle preference
  const [error, setError] = useState<string | null>(null);
  
  const wakeLockRef = useRef<any>(null);

  // Core Wake Lock request function
  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      setIsSupported(false);
      return;
    }

    // Only request if the user enabled it
    if (!isEnabled) {
      return;
    }

    try {
      // Release any existing wake lock first
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      const sentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setIsActive(true);
      setError(null);
      console.log('[WakeLock] Screen Wake Lock acquired successfully.');

      // Listen for release event (e.g. backgrounding, battery saver, lock screen)
      sentinel.addEventListener('release', () => {
        setIsActive(false);
        console.log('[WakeLock] Screen Wake Lock was released by browser.');
      });
    } catch (err: any) {
      setIsActive(false);
      setError(err.message || 'Wake Lock request failed.');
      console.warn('[WakeLock] Failed to acquire Screen Wake Lock:', err);
    }
  }, [isEnabled]);

  // Release function
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('[WakeLock] Screen Wake Lock manually released.');
      } catch (err) {
        console.error('[WakeLock] Error releasing Screen Wake Lock:', err);
      }
    }
  }, []);

  // Toggle user preference
  const toggleKeepAwake = useCallback(() => {
    setIsEnabled(prev => {
      const nextState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('keep_screen_awake', String(nextState));
      }
      return nextState;
    });
  }, []);

  // 1. Initialise preference from localStorage & request lock on mount
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'wakeLock' in navigator;
    setIsSupported(supported);

    if (typeof window !== 'undefined') {
      const persisted = localStorage.getItem('keep_screen_awake');
      if (persisted !== null) {
        setIsEnabled(persisted === 'true');
      }
    }
  }, []);

  // 2. Control lock status based on isEnabled preference and visibility state
  useEffect(() => {
    if (!isSupported) return;

    if (isEnabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isEnabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isSupported, isEnabled, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isActive,
    isEnabled,
    error,
    toggleKeepAwake,
    requestWakeLock,
    releaseWakeLock,
  };
}
