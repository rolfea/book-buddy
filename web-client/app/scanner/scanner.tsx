import { useCallback, useEffect, useRef, useState } from "react";
import type { Route } from "../+types/root";
import { BarcodeDetector } from "barcode-detector/ponyfill";

export function Scanner({ loaderData }: Route.ComponentProps) {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [capturedFrames, setCapturedFrames] = useState<ImageBitmap[]>([]);
  const [isBarcode, setIsBarcode] = useState<boolean>(false);
  const [capturedIsbns, setCapturedIsbns] = useState<string[]>([]);

  useEffect(() => {
    const getVideoStream = async () => {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (!videoStream) {
        setVideoStream(mediaStream);
      }
    };

    getVideoStream();
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    console.log(`scannin'`);
    const canvas = canvasRef.current;
    const img = capturedFrames.at(-1);

    if (img && canvas) {
      const detectBarcode = async () => {
        const detected = await barcodeDetector.detect(img);
        console.log(detected);
        setIsBarcode(!!detected.length);
        if (detected.length) {
          setIsBarcode(true);
          setCapturedIsbns([...capturedIsbns, detected[0].rawValue]);
          console.log(capturedIsbns);
        }
      };

      const canvasStyle: CSSStyleDeclaration = getComputedStyle(canvas);
      const canvasWidth = Number(canvasStyle.width.split("px")[0]);
      const canvasHeight = Number(canvasStyle.height.split("px")[0]);
      const ratio = Math.min(canvasWidth / img?.width, canvasHeight / img.height);
      const x = (canvasWidth - img.width * ratio) / 2;
      const y = (canvasHeight - img.height * ratio) / 2;

      const canvasContext = canvas.getContext("2d");
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

      detectBarcode();
    }
  }, [capturedFrames]);

  const barcodeDetector = new BarcodeDetector({ formats: ["ean_13"] });
  // TODO - DefinitelyTyped - I think I need "DefinitelyTyped" type lib to get this
  // @ts-ignore
  console.log(videoStream);
  const imageCapture = !!videoStream ? new ImageCapture(videoStream) : {};

  const refVideo = useCallback(
    (node: HTMLVideoElement) => {
      if (node) {
        node.srcObject = videoStream;
      }
    },
    [videoStream],
  );

  // TODO - DefinitelyTyped
  // @ts-ignore
  const grabFrame = async (imageCapture: ImageCapture) => {
    const capturedFrame = await imageCapture.grabFrame();
    setCapturedFrames([...capturedFrames, capturedFrame]);
  };

  const capturedIsbnList = capturedIsbns.map((i) => <li>{i}</li>);

  return (
    <div>
      <h1>Scan a barcode using your device's camera</h1>
      <video ref={refVideo} autoPlay></video>
      <button onClick={() => grabFrame(imageCapture)}>Capture Barcode</button>

      <canvas ref={canvasRef}></canvas>
      <p>is this a barcode? {isBarcode ? "yes!" : "nope!"}</p>
      <p>Captured ISBNs:</p>
      <ul>{capturedIsbnList}</ul>
    </div>
  );
}
