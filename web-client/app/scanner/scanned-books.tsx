import {
  BarcodeDetector,
  type DetectedBarcode,
} from 'barcode-detector/ponyfill';
import { useEffect, useRef, useState } from 'react';
import { Booklist } from '~/book-list/bookList';

interface ScannedIsbn {
  value: string;
  isDuplicate: boolean;
}

export interface ScannedBooksProps {
  latestFrame: ImageBitmap | null;
  onIsbnDetected?: () => void;
}

export function ScannedBooks({ latestFrame, onIsbnDetected }: ScannedBooksProps) {
  const [scannedIsbns, setScannedIsbns] = useState<ScannedIsbn[]>([]);
  const seenIsbns = useRef(new Set<string>());
  const barcodeDetectorRef = useRef(new BarcodeDetector({ formats: ['ean_13'] }));

  useEffect(() => {
    const detectBarcode = async () => {
      if (!latestFrame) return;

      const detected = await barcodeDetectorRef.current.detect(latestFrame);
      if (detected && detected.length > 0) {
        const codes = detected.map((d) => d.rawValue).filter((d) => d);

        if (codes.length > 0) {
          const newIsbns: ScannedIsbn[] = codes.map((code) => ({
            value: code,
            isDuplicate: seenIsbns.current.has(code),
          }));

          // Add to seen set
          codes.forEach((code) => seenIsbns.current.add(code));

          setScannedIsbns((prev) => [...prev, ...newIsbns]);
          onIsbnDetected?.();
        }
      }
    };

    detectBarcode();
  }, [latestFrame, onIsbnDetected]);

  useEffect(() => {
    console.info(`Debug Log - Scanned Books is now: ${scannedIsbns.map((i) => i.value)}`);
  }, [scannedIsbns]);

  const isbns = scannedIsbns.map((isbn, index) => (
    <li key={`${isbn.value}-${index}`}>
      {isbn.value}
      {isbn.isDuplicate && <span style={{ color: 'gray' }}> (duplicate)</span>}
    </li>
  ));

  return (
    <div>
      <h1>Scanned Isbns</h1>
      <ul>{isbns}</ul>

      <Booklist scannedIsbns={scannedIsbns.map((i) => i.value)} />
    </div>
  );
}
