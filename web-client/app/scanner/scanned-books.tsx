import {
  BarcodeDetector,
  type DetectedBarcode,
} from 'barcode-detector/ponyfill';
import { useEffect, useState } from 'react';
import { Booklist } from '~/book-list/bookList';

export interface ScannedBooksProps {
  capturedFrames: ImageBitmap[];
}

export function ScannedBooks({ capturedFrames }: ScannedBooksProps) {
  const [scannedIsbns, setScannedIsbns] = useState<
    DetectedBarcode['rawValue'][]
  >([]);

  useEffect(() => {
    const detectBarcode = async () => {
      const latest = capturedFrames.at(-1);
      const detected = latest ? await barcodeDetector.detect(latest) : null;
      if (!!detected) {
        const codes = detected.map((d) => d.rawValue).filter((d) => d);
        setScannedIsbns([...scannedIsbns, ...codes]);
      }
    };

    detectBarcode();
  }, [capturedFrames]);

  useEffect(() => {
    console.info(`Debug Log - Scanned Books is now: ${scannedIsbns}`);
  }, [scannedIsbns]);

  const barcodeDetector = new BarcodeDetector({ formats: ['ean_13'] });

  const isbns = scannedIsbns.map((isbn) => (
    <li key={crypto.randomUUID()}>{isbn}</li>
  ));
  return (
    <div>
      <h1>Scanned Isbns</h1>
      <ul>{isbns}</ul>

      <Booklist scannedIsbns={scannedIsbns} />
    </div>
  );
}
