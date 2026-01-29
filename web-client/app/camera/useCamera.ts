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
    const getVideoTrack = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (!videoStream) {
          setVideoStream(mediaStream);
        }

        const track = mediaStream.getVideoTracks()[0];

        if (!videoTrack) {
          setVideoTrack(track);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Camera access failed'));
      }
    };

    getVideoTrack();
  }, [videoStream, videoTrack]);

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
