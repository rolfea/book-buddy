import { useCallback, useEffect, useRef, useState } from 'react';

const CAPTURE_INTERVAL_MS = 500;
const COOLDOWN_DURATION_MS = 2000;

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  latestFrame: ImageBitmap | null;
  isReady: boolean;
  isCapturing: boolean;
  isCoolingDown: boolean;
  error: Error | null;
  startCapture: () => void;
  stopCapture: () => void;
  triggerCooldown: () => void;
}

export function useCamera(): UseCameraResult {
  const [latestFrame, setLatestFrame] = useState<ImageBitmap | null>(null);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const cooldownTimeoutRef = useRef<number | null>(null);

  // Set up the camera
  useEffect(() => {
    if (videoStream) return;

    let cancelled = false;

    const getVideoTrack = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(new Error('Camera API not available'));
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        setVideoStream(mediaStream);
        setVideoTrack(mediaStream.getVideoTracks()[0]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Camera access failed'));
        }
      }
    };

    getVideoTrack();

    return () => {
      cancelled = true;
    };
  }, [videoStream]);

  // Set video source when stream is available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const grabFrame = useCallback(async () => {
    if (!videoTrack) return;

    // @ts-ignore - ImageCapture lacks TypeScript types
    const imageCapture = new ImageCapture(videoTrack);
    const capturedFrame = await imageCapture.grabFrame();
    setLatestFrame((prev) => {
      prev?.close(); // Free memory from previous frame
      return capturedFrame;
    });
  }, [videoTrack]);

  // Auto-capture interval
  useEffect(() => {
    if (isCapturing && !isCoolingDown && videoTrack) {
      intervalRef.current = window.setInterval(() => {
        grabFrame();
      }, CAPTURE_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCapturing, isCoolingDown, videoTrack, grabFrame]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach((track) => track.stop());
    };
  }, [videoStream]);

  // Cleanup cooldown timeout on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  const startCapture = useCallback(() => {
    setIsCapturing(true);
  }, []);

  const stopCapture = useCallback(() => {
    setIsCapturing(false);
  }, []);

  const triggerCooldown = useCallback(() => {
    // Clear any existing cooldown to prevent race conditions
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }
    setIsCoolingDown(true);
    cooldownTimeoutRef.current = window.setTimeout(() => {
      setIsCoolingDown(false);
    }, COOLDOWN_DURATION_MS);
  }, []);

  const isReady = videoTrack !== null;

  return {
    videoRef,
    latestFrame,
    isReady,
    isCapturing,
    isCoolingDown,
    error,
    startCapture,
    stopCapture,
    triggerCooldown,
  };
}
