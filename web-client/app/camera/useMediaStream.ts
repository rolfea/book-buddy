import { useEffect, useRef, useState } from 'react';

export interface UseMediaStreamResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoStream: MediaStream | null;
  isReady: boolean;
  error: Error | null;
}

export function useMediaStream(): UseMediaStreamResult {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Set up the camera
  useEffect(() => {
    if (videoStream) return;

    let cancelled = false;

    const getVideoStream = async () => {
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
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Camera access failed'));
        }
      }
    };

    getVideoStream();

    return () => {
      cancelled = true;
    };
  }, [videoStream]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach((track) => track.stop());
    };
  }, [videoStream]);

  const isReady = videoStream !== null;

  return {
    videoRef,
    videoStream,
    isReady,
    error,
  };
}
