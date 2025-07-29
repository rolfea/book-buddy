import { useCallback, useEffect, useState } from 'react';
import type { Route } from '../+types/root';
import { BarcodeDetector } from 'barcode-detector/ponyfill';

export function Scanner({ loaderData }: Route.ComponentProps) {
  const [videoTrack, setVideoTrack] = useState(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
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

  const barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });
  const imageCapture = !!videoTrack ? new ImageCapture(videoTrack) : {};

  if (!!imageCapture?.track) {
    console.log(imageCapture);
  }

  if (!!videoStream) {
    console.log(videoStream);
  }

  const refVideo = useCallback(
    (node: HTMLVideoElement) => {
      if (node) {
        node.srcObject = videoStream;
      }
    },
    [videoStream],
  );

  return (
    <div>
      <h1>{loaderData?.sample}</h1>
      <video ref={refVideo} autoPlay></video>
    </div>
  );
}
