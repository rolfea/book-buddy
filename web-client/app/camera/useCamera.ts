import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  capturedFrames: ImageBitmap[];
  grabFrame: () => Promise<void>;
  isReady: boolean;
  error: Error | null;
}

export function useCamera(): UseCameraResult {
  const [capturedFrames, setCapturedFrames] = useState<ImageBitmap[]>([]);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

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
          // Cleanup if component unmounted or effect re-ran
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
    setCapturedFrames((prev) => [...prev, capturedFrame]);
  }, [videoTrack]);

  const isReady = videoTrack !== null;

  return {
    videoRef,
    capturedFrames,
    grabFrame,
    isReady,
    error,
  };
}
