import { useCallback, useState } from 'react';

export interface UseFrameCaptureResult {
  latestFrame: ImageBitmap | null;
  grabFrame: () => Promise<void>;
}

export function useFrameCapture(videoStream: MediaStream | null): UseFrameCaptureResult {
  const [latestFrame, setLatestFrame] = useState<ImageBitmap | null>(null);

  const grabFrame = useCallback(async () => {
    if (!videoStream) return;

    const videoTrack = videoStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // @ts-ignore - ImageCapture lacks TypeScript types
    const imageCapture = new ImageCapture(videoTrack);
    const capturedFrame = await imageCapture.grabFrame();

    setLatestFrame((prev) => {
      prev?.close(); // Free memory from previous frame
      return capturedFrame;
    });
  }, [videoStream]);

  return {
    latestFrame,
    grabFrame,
  };
}
