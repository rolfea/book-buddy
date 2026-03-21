import { useCallback, useRef, useState } from 'react';

import { ScannedBooks } from '~/scanner/scanned-books';
import { useMediaStream } from './useMediaStream';
import { useFrameCapture } from './useFrameCapture';
import { useAutoCapture } from './useAutoCapture';

const COOLDOWN_DURATION_MS = 2000;

export function Camera() {
  const { videoRef, videoStream, isReady, error } = useMediaStream();
  const { latestFrame, grabFrame } = useFrameCapture(videoStream);

  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const cooldownTimeoutRef = useRef<number | null>(null);

  const { isCapturing, startCapture, stopCapture } = useAutoCapture(grabFrame, {
    enabled: !isCoolingDown,
  });

  const handleIsbnDetected = useCallback(() => {
    // Clear any existing cooldown to prevent race conditions
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    setIsCoolingDown(true);
    cooldownTimeoutRef.current = window.setTimeout(() => {
      setIsCoolingDown(false);
    }, COOLDOWN_DURATION_MS);
  }, []);

  return (
    <div>
      <h1>I'm a camera!</h1>
      {error && <p>Camera error: {error.message}</p>}
      <video ref={videoRef} autoPlay></video>

      <div>
        {isCapturing ? (
          <button onClick={stopCapture}>Stop Capture</button>
        ) : (
          <button onClick={startCapture} disabled={!isReady}>
            Start Capture
          </button>
        )}
        {isCoolingDown && <span> Paused...</span>}
      </div>

      <ScannedBooks latestFrame={latestFrame} onIsbnDetected={handleIsbnDetected} />
    </div>
  );
}
