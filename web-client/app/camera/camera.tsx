import { useCallback, useEffect, useRef, useState } from 'react';

import { ScannedBooks } from '~/scanner/scanned-books';

export function Camera() {
  const [capturedFrames, setCapturedFrames] = useState<ImageBitmap[]>([]);

  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  // not sure if useCallback or useRef is the right move here
  // so why not both??
  const refVideo = useCallback(
    (node: HTMLVideoElement) => {
      if (node) {
        node.srcObject = videoStream;
      }
    },
    [videoStream],
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // set up the camera
  useEffect(() => {
    const getVideoTrack = async () => {
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
    };

    getVideoTrack();
  }, [videoStream]);

  // sketchy-ass init of canvas to draw the video frames to
  useEffect(() => {
    const canvas = canvasRef.current;
    // most recent image captured
    const img = capturedFrames.at(-1);

    // draw it to the canvas
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

  // TODO - DefinitelyTyped - I think I need "DefinitelyTyped" type lib to get this
  // @ts-ignore
  const imageCapture = !!videoTrack ? new ImageCapture(videoTrack) : {};

  // TODO - DefinitelyTyped
  // @ts-ignore
  const grabFrame = async (imageCapture: ImageCapture) => {
    const capturedFrame = await imageCapture.grabFrame();
    setCapturedFrames([...capturedFrames, capturedFrame]);
  };

  return (
    <div>
      <h1>I'm a camera!</h1>
      <video ref={refVideo} autoPlay></video>
      <button onClick={() => grabFrame(imageCapture)}>Capture Barcode</button>

      <canvas ref={canvasRef}></canvas>
      <ScannedBooks capturedFrames={capturedFrames} />
    </div>
  );
}
