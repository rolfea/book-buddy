import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_INTERVAL_MS = 500;

export interface UseAutoCaptureOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export interface UseAutoCaptureResult {
  isCapturing: boolean;
  startCapture: () => void;
  stopCapture: () => void;
}

export function useAutoCapture(
  onCapture: () => void,
  options: UseAutoCaptureOptions = {}
): UseAutoCaptureResult {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;

  const [isCapturing, setIsCapturing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Auto-capture interval
  useEffect(() => {
    if (isCapturing && enabled) {
      intervalRef.current = window.setInterval(() => {
        onCapture();
      }, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCapturing, enabled, intervalMs, onCapture]);

  const startCapture = useCallback(() => {
    setIsCapturing(true);
  }, []);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  return {
    isCapturing,
    startCapture,
    stopCapture,
  };
}
