import { useEffect, useRef } from 'react';

import { ScannedBooks } from '~/scanner/scanned-books';
import { useCamera } from './useCamera';

export function Camera() {
  const { videoRef, capturedFrames, grabFrame, isReady, error } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw captured frames to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = capturedFrames.at(-1);

    if (img && canvas) {
      const canvasStyle: CSSStyleDeclaration = getComputedStyle(canvas);
      const canvasWidth = Number(canvasStyle.width.split('px')[0]);
      const canvasHeight = Number(canvasStyle.height.split('px')[0]);
      const ratio = Math.min(
        canvasWidth / img?.width,
        canvasHeight / img.height,
      );
      const x = (canvasWidth - img.width * ratio) / 2;
      const y = (canvasHeight - img.height * ratio) / 2;

      const canvasContext = canvas.getContext('2d');
      if (canvasContext) {
        canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);

        canvasContext.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          x,
          y,
          img.width * ratio,
          img.height * ratio,
        );
      }
    }
  }, [capturedFrames]);

  return (
    <div>
      <h1>I'm a camera!</h1>
      {error && <p>Camera error: {error.message}</p>}
      <video ref={videoRef} autoPlay></video>
      <button onClick={grabFrame} disabled={!isReady}>
        Capture Barcode
      </button>

      <canvas ref={canvasRef}></canvas>
      <ScannedBooks capturedFrames={capturedFrames} />
    </div>
  );
}
