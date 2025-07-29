import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route } from '../+types/root';
import { BarcodeDetector } from 'barcode-detector/ponyfill';

export function Scanner({ loaderData }: Route.ComponentProps) {
  const [videoTrack, setVideoTrack] = useState(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<ImageBitmap[]>([]);
  const [isBarcode, setIsBarcode] = useState<boolean>(false);

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
  });

  const canvasRef = useRef(null);

  useEffect(() => {
    console.log(`scannin'`);
    const canvas = canvasRef.current;
    const img = capturedFrames.at(-1);

    const detectBarcode = async () => {
      const detected = await barcodeDetector.detect(img);
      console.log(detected);
      setIsBarcode(detected.length);
    };

    if (img && canvas) {
      canvas.width = getComputedStyle(canvas).width.split('px')[0];
      canvas.height = getComputedStyle(canvas).height.split('px')[0];
      let ratio = Math.min(
        canvas.width / img?.width,
        canvas.height / img.height,
      );
      let x = (canvas.width - img.width * ratio) / 2;
      let y = (canvas.height - img.height * ratio) / 2;

      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

      canvas
        .getContext('2d')
        .drawImage(
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

      detectBarcode();
    }
  }, [capturedFrames]);

  const barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });
  const imageCapture = !!videoTrack ? new ImageCapture(videoTrack) : {};

  const refVideo = useCallback(
    (node: HTMLVideoElement) => {
      if (node) {
        node.srcObject = videoStream;
      }
    },
    [videoStream],
  );

  const grabFrame = async (imageCapture: ImageCapture) => {
    const capturedFrame = await imageCapture.grabFrame();
    setCapturedFrames([...capturedFrames, capturedFrame]);
  };

  return (
    <div>
      <h1>Scan a barcode using your device's camera</h1>
      <video ref={refVideo} autoPlay></video>
      <button onClick={() => grabFrame(imageCapture)}>Capture Barcode</button>

      <canvas ref={canvasRef}></canvas>
      <p>is this a barcode? {isBarcode ? 'yes!' : 'nope!'}</p>
    </div>
  );
}
