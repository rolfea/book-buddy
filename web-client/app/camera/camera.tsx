import { ScannedBooks } from '~/scanner/scanned-books';
import { useCamera } from './useCamera';

export function Camera() {
  const {
    videoRef,
    latestFrame,
    isReady,
    isCapturing,
    isCoolingDown,
    error,
    startCapture,
    stopCapture,
    triggerCooldown,
  } = useCamera();

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

      <ScannedBooks latestFrame={latestFrame} onIsbnDetected={triggerCooldown} />
    </div>
  );
}
